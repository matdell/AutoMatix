import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, MerchantStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ValidationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private isMerchantNumberValid(value?: string | null) {
    if (!value) return false;
    return /^[A-Z0-9-]{6,}$/.test(value);
  }

  async run(tenantId: string, merchantId: string, actorId?: string) {
    const merchants = await this.prisma.merchant.findMany({
      where: {
        tenantId,
        id: merchantId,
      },
    });
    if (merchants.length === 0) {
      throw new BadRequestException('Razon social no encontrada para este banco');
    }

    let errores = 0;

    for (const merchant of merchants) {
      const valid = this.isMerchantNumberValid(merchant.merchantNumber);
      if (!valid) {
        const existing = await this.prisma.validationError.findFirst({
          where: {
            tenantId,
            merchantId: merchant.id,
            codigo: 'MID_INVALIDO',
            resuelto: false,
          },
        });

        if (!existing) {
          await this.prisma.validationError.create({
            data: {
              tenantId,
              merchantId: merchant.id,
              codigo: 'MID_INVALIDO',
              mensaje: 'El numero de comercio es invalido o esta incompleto.',
            },
          });
          errores += 1;
        }

        await this.prisma.merchant.update({
          where: { id: merchant.id },
          data: { estado: MerchantStatus.RESTRICTED },
        });

        await this.notifications.sendValidationError(
          tenantId,
          merchant.contactoEmail || 'sin-email@local',
          `Detectamos un problema con tu numero de comercio (${merchant.merchantNumber || 'sin dato'}).`,
        );

        await this.audit.log({
          tenantId,
          userId: actorId ?? null,
          action: AuditAction.UPDATE,
          entity: 'Merchant',
          entityId: merchant.id,
          before: { estado: merchant.estado },
          after: { estado: MerchantStatus.RESTRICTED },
        });
      }
    }

    return { errores };
  }

  async listErrors(tenantId: string) {
    return this.prisma.validationError.findMany({
      where: { tenantId },
      include: { merchant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveError(tenantId: string, id: string, actorId?: string) {
    const error = await this.prisma.validationError.findFirst({ where: { tenantId, id } });
    if (!error) {
      return { ok: false };
    }
    const updated = await this.prisma.validationError.update({
      where: { id },
      data: { resuelto: true },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'ValidationError',
      entityId: id,
      before: { resuelto: error.resuelto },
      after: { resuelto: updated.resuelto },
    });

    return { ok: true };
  }
}
