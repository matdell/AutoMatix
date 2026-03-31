import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as docusign from 'docusign-esign';

@Injectable()
export class DocusignService {
  private client?: any;

  constructor(private config: ConfigService) {
    const basePath = this.config.get<string>('DOCUSIGN_BASE_PATH');
    const accessToken = this.config.get<string>('DOCUSIGN_ACCESS_TOKEN');
    if (basePath && accessToken) {
      const apiClient = new docusign.ApiClient();
      apiClient.setBasePath(basePath);
      apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);
      this.client = apiClient;
    }
  }

  async createEnvelope(payload: {
    accountId: string;
    email: string;
    name: string;
    subject: string;
  }) {
    if (!this.client) {
      return { status: 'SIMULADO' };
    }

    const envelopesApi = new docusign.EnvelopesApi(this.client);
    const env = new docusign.EnvelopeDefinition();
    env.emailSubject = payload.subject;
    env.status = 'sent';

    const signer = docusign.Signer.constructFromObject({
      email: payload.email,
      name: payload.name,
      recipientId: '1',
    });

    const recipients = docusign.Recipients.constructFromObject({
      signers: [signer],
    });

    env.recipients = recipients;

    return envelopesApi.createEnvelope(payload.accountId, { envelopeDefinition: env });
  }
}
