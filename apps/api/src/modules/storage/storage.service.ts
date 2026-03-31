import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface UploadInput {
  tenantId: string;
  buffer: Buffer;
  contentType: string;
  filename: string;
  prefix: string;
}

@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl?: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('R2_BUCKET') || '';
    this.publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL') || undefined;
    this.client = new S3Client({
      region: 'auto',
      endpoint: this.config.get<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') || '',
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async upload(input: UploadInput) {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${input.tenantId}/${input.prefix}/${Date.now()}-${safeName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );

    const url = this.publicBaseUrl ? `${this.publicBaseUrl}/${key}` : key;
    return { key, url };
  }
}
