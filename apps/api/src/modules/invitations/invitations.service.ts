import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, InvitationStatus, MerchantStatus, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { branches: true, merchant: true },
    });
  }

  async create(tenantId: string, dto: CreateInvitationDto, actorId?: string) {
    const token = randomUUID();
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        email: dto.email,
        merchantId: dto.merchantId ?? null,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        branches: dto.branchIds
          ? {
              create: dto.branchIds.map((branchId) => ({ tenantId, branchId })),
            }
          : undefined,
      },
      include: { branches: true },
    });

    await this.notifications.sendInvitation(tenantId, dto.email, token);

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Invitation',
      entityId: invitation.id,
      after: { email: invitation.email, status: invitation.status },
    });

    return invitation;
  }

  async accept(token: string, dto: AcceptInvitationDto) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { branches: true },
    });

    if (invitation?.expiresAt && invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }
    if (
      !invitation ||
      invitation.status !== InvitationStatus.INVITED ||
      (invitation.expiresAt && invitation.expiresAt < new Date()) ||
      dto.email.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      throw new BadRequestException('Invitacion invalida o expirada');
    }

    let merchantId = invitation.merchantId;
    if (!merchantId) {
      const merchant = await this.prisma.merchant.create({
        data: {
          tenantId: invitation.tenantId,
          nombre: dto.merchantNombre,
          categoria: dto.categoria ?? 'Sin categoria',
          estado: MerchantStatus.PENDING,
          cuit: dto.cuit,
          merchantNumber: dto.merchantNumber,
          contactoEmail: dto.email,
          telefono: dto.telefono,
        },
      });
      merchantId = merchant.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        tenantId: invitation.tenantId,
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        role: Role.MERCHANT_ADMIN,
        merchantId,
      },
    });
    await this.audit.log({
      tenantId: invitation.tenantId,
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: createdUser.id,
      after: {
        email: createdUser.email,
        role: createdUser.role,
        merchantId: createdUser.merchantId,
      },
    });

    const updated = await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED },
    });

    await this.audit.log({
      tenantId: invitation.tenantId,
      action: AuditAction.UPDATE,
      entity: 'Invitation',
      entityId: invitation.id,
      before: { status: invitation.status },
      after: { status: updated.status },
    });

    return { ok: true };
  }

  async reject(token: string, email: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (
      !invitation ||
      invitation.status !== InvitationStatus.INVITED ||
      !email ||
      invitation.email.toLowerCase() !== email.toLowerCase()
    ) {
      throw new BadRequestException('Invitacion invalida o expirada');
    }

    const updated = await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REJECTED },
    });

    await this.audit.log({
      tenantId: invitation.tenantId,
      action: AuditAction.UPDATE,
      entity: 'Invitation',
      entityId: invitation.id,
      before: { status: invitation.status },
      after: { status: updated.status },
    });

    return { ok: true };
  }
}
