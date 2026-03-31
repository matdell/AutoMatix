import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Role } from '@prisma/client';

@Injectable()
export class BanksService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(dto: CreateBankDto) {
    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
    const bank = await this.prisma.bank.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
        paymentMethods: dto.paymentMethods ?? [],
        bines: dto.bines ?? [],
        users: {
          create: {
            email: dto.adminEmail,
            passwordHash,
            nombre: dto.adminNombre,
            role: Role.BANK_ADMIN,
          },
        },
      },
      include: { users: true },
    });

    return {
      id: bank.id,
      nombre: bank.nombre,
      slug: bank.slug,
      admin: bank.users[0],
    };
  }

  async list() {
    return this.prisma.bank.findMany({
      select: {
        id: true,
        nombre: true,
        slug: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCurrent(tenantId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: tenantId },
    });
    if (!bank) {
      throw new NotFoundException('Banco no encontrado');
    }
    return bank;
  }

  async updateCurrent(tenantId: string, dto: UpdateBankDto, actorId?: string) {
    const before = await this.prisma.bank.findUnique({ where: { id: tenantId } });
    if (!before) {
      throw new NotFoundException('Banco no encontrado');
    }
    const updated = await this.prisma.bank.update({
      where: { id: tenantId },
      data: {
        nombre: dto.nombre ?? undefined,
        paymentMethods: dto.paymentMethods ?? undefined,
        bines: dto.bines ?? undefined,
        logoUrl: dto.logoUrl ?? undefined,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Bank',
      entityId: tenantId,
      before: {
        nombre: before.nombre,
        paymentMethods: before.paymentMethods,
        bines: before.bines,
        logoUrl: before.logoUrl,
      },
      after: {
        nombre: updated.nombre,
        paymentMethods: updated.paymentMethods,
        bines: updated.bines,
        logoUrl: updated.logoUrl,
      },
    });

    return updated;
  }
}
