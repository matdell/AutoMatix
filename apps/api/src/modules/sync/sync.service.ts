import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as fs from 'fs';
import * as crypto from 'crypto';

interface SyncResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

@Injectable()
export class SyncService {
  private agent?: https.Agent;
  private baseUrl: string;
  private bankId: string;
  private hmacSecret?: string;
  private certPath?: string;
  private keyPath?: string;
  private caPath?: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('CENTRAL_SYNC_BASE_URL') ||
      'https://dev.automatixpay.com';
    this.bankId = this.configService.get<string>('SYNC_BANK_ID') || 'bank1';
    this.hmacSecret = this.configService.get<string>('SYNC_HMAC_SECRET');
    this.certPath = this.configService.get<string>('SYNC_CLIENT_CERT_PATH');
    this.keyPath = this.configService.get<string>('SYNC_CLIENT_KEY_PATH');
    this.caPath = this.configService.get<string>('SYNC_CA_CERT_PATH');
  }

  private ensureAgent() {
    if (this.agent) return this.agent;
    if (!this.certPath || !this.keyPath) {
      throw new Error('SYNC_CLIENT_CERT_PATH y SYNC_CLIENT_KEY_PATH son requeridos');
    }
    const cert = fs.readFileSync(this.certPath);
    const key = fs.readFileSync(this.keyPath);
    const ca = this.caPath ? fs.readFileSync(this.caPath) : undefined;
    this.agent = new https.Agent({ cert, key, ca });
    return this.agent;
  }

  private buildUrl(path: string, query: Record<string, string | undefined>) {
    const url = new URL(path, this.baseUrl);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    });
    return url;
  }

  private request(method: 'GET' | 'POST', url: URL, body?: string): Promise<SyncResponse> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'X-Bank-Id': this.bankId,
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(body).toString();
      }

      const req = https.request(
        url,
        {
          method,
          agent: this.ensureAgent(),
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body: data,
            });
          });
        },
      );

      req.on('error', reject);

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  private verifySignature(body: string, signature?: string) {
    if (!signature || !this.hmacSecret) return null;
    const expected = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(body)
      .digest('hex');
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expected, 'utf8'),
    );
  }

  async pullBatch(entity: string, cursor?: string, bankIdOverride?: string) {
    const bankId = bankIdOverride || this.bankId;
    const url = this.buildUrl('/sync/batch', {
      bankId,
      entity,
      cursor: cursor || '0',
    });
    const response = await this.request('GET', url);
    const signature = response.headers['x-signature'] as string | undefined;
    const signatureValid = this.verifySignature(response.body, signature);

    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(response.body);
    } catch {
      parsedBody = response.body;
    }

    return {
      statusCode: response.statusCode,
      signature,
      signatureValid,
      data: parsedBody,
    };
  }

  async ackBatch(params: {
    entity: string;
    batchId: string;
    cursor?: string;
    status?: string;
    error?: string;
    bankId?: string;
  }) {
    const bankId = params.bankId || this.bankId;
    const url = this.buildUrl('/sync/ack', {});
    const body = JSON.stringify({
      bankId,
      entity: params.entity,
      batchId: params.batchId,
      cursor: params.cursor,
      status: params.status || 'ACK',
      error: params.error,
    });
    const response = await this.request('POST', url, body);
    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(response.body);
    } catch {
      parsedBody = response.body;
    }
    return {
      statusCode: response.statusCode,
      data: parsedBody,
    };
  }
}
