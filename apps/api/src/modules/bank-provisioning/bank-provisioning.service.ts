import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import {
  ProvisioningStatus,
  ProvisioningTarget,
  Prisma,
} from '@prisma/client';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { CreateBankProvisioningRequestDto } from './dto/create-bank-provisioning-request.dto';
import { UpdateBankProvisioningStatusDto } from './dto/update-bank-provisioning-status.dto';

type JsonMap = Record<string, unknown>;

@Injectable()
export class BankProvisioningService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async ensureBank(bankId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, nombre: true, slug: true },
    });
    if (!bank) {
      throw new NotFoundException('Banco no encontrado');
    }
    return bank;
  }

  private pickString(map: JsonMap | undefined, key: string) {
    const value = map?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private ensureTargetRequirements(dto: CreateBankProvisioningRequestDto) {
    if (!dto.domain?.trim() || !dto.apiDomain?.trim()) {
      throw new BadRequestException('domain y apiDomain son obligatorios');
    }

    const config = dto.config ?? {};
    const credentials = dto.credentials ?? {};

    if (dto.target === ProvisioningTarget.VPS_MANAGED) {
      if (!this.pickString(config, 'host') || !this.pickString(credentials, 'sshUser')) {
        throw new BadRequestException(
          'Para VPS_MANAGED se requiere config.host y credentials.sshUser',
        );
      }
    }

    if (dto.target === ProvisioningTarget.CUSTOMER_CLOUD) {
      if (!dto.provider?.trim()) {
        throw new BadRequestException('Para CUSTOMER_CLOUD se requiere provider');
      }
      const hasRoleArn = Boolean(this.pickString(credentials, 'roleArn'));
      const hasAccessKey = Boolean(this.pickString(credentials, 'accessKeyId'));
      if (!hasRoleArn && !hasAccessKey) {
        throw new BadRequestException(
          'Para CUSTOMER_CLOUD se requiere credentials.roleArn o credentials.accessKeyId',
        );
      }
    }

    if (dto.target === ProvisioningTarget.ON_PREM) {
      if (!this.pickString(config, 'endpoint')) {
        throw new BadRequestException('Para ON_PREM se requiere config.endpoint');
      }
    }
  }

  private encryptCredentials(credentials?: JsonMap): Prisma.InputJsonValue | undefined {
    if (!credentials || Object.keys(credentials).length === 0) {
      return undefined;
    }
    const secret =
      this.config.get<string>('PROVISIONING_CREDENTIALS_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'local-dev-provisioning-key';

    const key = createHash('sha256').update(secret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = JSON.stringify(credentials);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('base64');

    return {
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag,
      data: encrypted,
    };
  }

  private sanitize(
    request: {
      id: string;
      bankId: string;
      target: ProvisioningTarget;
      status: ProvisioningStatus;
      provider: string | null;
      domain: string | null;
      apiDomain: string | null;
      region: string | null;
      config: Prisma.JsonValue | null;
      credentials: Prisma.JsonValue | null;
      notes: string | null;
      createdByUserId: string | null;
      processedAt: Date | null;
      errorMessage: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
    return {
      id: request.id,
      bankId: request.bankId,
      target: request.target,
      status: request.status,
      provider: request.provider,
      domain: request.domain,
      apiDomain: request.apiDomain,
      region: request.region,
      config: request.config,
      notes: request.notes,
      createdByUserId: request.createdByUserId,
      processedAt: request.processedAt,
      errorMessage: request.errorMessage,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      hasCredentials: request.credentials !== null,
    };
  }

  async list(bankId: string) {
    await this.ensureBank(bankId);
    const requests = await this.prisma.bankProvisioningRequest.findMany({
      where: { bankId },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((request) => this.sanitize(request));
  }

  async create(
    bankId: string,
    dto: CreateBankProvisioningRequestDto,
    userId?: string,
  ) {
    await this.ensureBank(bankId);
    this.ensureTargetRequirements(dto);

    const request = await this.prisma.bankProvisioningRequest.create({
      data: {
        bankId,
        target: dto.target,
        status: ProvisioningStatus.REQUESTED,
        provider: dto.provider?.trim() || null,
        domain: dto.domain?.trim() || null,
        apiDomain: dto.apiDomain?.trim() || null,
        region: dto.region?.trim() || null,
        config: (dto.config ?? null) as Prisma.InputJsonValue,
        credentials: this.encryptCredentials(dto.credentials),
        notes: dto.notes?.trim() || null,
        createdByUserId: userId ?? null,
      },
    });

    return this.sanitize(request);
  }

  async updateStatus(
    bankId: string,
    requestId: string,
    dto: UpdateBankProvisioningStatusDto,
  ) {
    await this.ensureBank(bankId);

    const existing = await this.prisma.bankProvisioningRequest.findFirst({
      where: { id: requestId, bankId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Solicitud de provisionamiento no encontrada');
    }

    const finalStatuses = new Set<ProvisioningStatus>([
      ProvisioningStatus.READY,
      ProvisioningStatus.FAILED,
      ProvisioningStatus.CANCELLED,
    ]);

    const updated = await this.prisma.bankProvisioningRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        notes: dto.notes?.trim() || undefined,
        errorMessage: dto.errorMessage?.trim() || null,
        processedAt: finalStatuses.has(dto.status) ? new Date() : null,
      },
    });

    return this.sanitize(updated);
  }
}

