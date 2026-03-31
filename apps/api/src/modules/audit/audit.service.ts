import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

interface AuditInput {
  tenantId: string;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditInput) {
    const toJson = (value?: Record<string, unknown> | null) =>
      value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);

    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: toJson(input.before),
        after: toJson(input.after),
      },
    });
  }
}
