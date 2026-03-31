import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { UpdateBankSuperadminDto } from './dto/update-bank-superadmin.dto';
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
        nombreCompleto: dto.nombreCompleto ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionCasaMatriz: dto.direccionCasaMatriz ?? undefined,
        slug: dto.slug,
        paymentMethods: dto.paymentMethods ?? [],
        bines: dto.bines ?? [],
        fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
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
        nombreCompleto: true,
        razonSocial: true,
        cuit: true,
        direccionCasaMatriz: true,
        slug: true,
        activo: true,
        paymentMethods: true,
        bines: true,
        fechaAlta: true,
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
        nombreCompleto: dto.nombreCompleto ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionCasaMatriz: dto.direccionCasaMatriz ?? undefined,
        paymentMethods: dto.paymentMethods ?? undefined,
        bines: dto.bines ?? undefined,
        fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
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
        nombreCompleto: before.nombreCompleto,
        razonSocial: before.razonSocial,
        cuit: before.cuit,
        direccionCasaMatriz: before.direccionCasaMatriz,
        paymentMethods: before.paymentMethods,
        bines: before.bines,
        fechaAlta: before.fechaAlta,
        logoUrl: before.logoUrl,
      },
      after: {
        nombre: updated.nombre,
        nombreCompleto: updated.nombreCompleto,
        razonSocial: updated.razonSocial,
        cuit: updated.cuit,
        direccionCasaMatriz: updated.direccionCasaMatriz,
        paymentMethods: updated.paymentMethods,
        bines: updated.bines,
        fechaAlta: updated.fechaAlta,
        logoUrl: updated.logoUrl,
      },
    });

    return updated;
  }

  async updateById(bankId: string, dto: UpdateBankSuperadminDto, actorId?: string) {
    const before = await this.prisma.bank.findUnique({ where: { id: bankId } });
    if (!before) {
      throw new NotFoundException('Banco no encontrado');
    }

    const updated = await this.prisma.bank.update({
      where: { id: bankId },
      data: {
        nombre: dto.nombre ?? undefined,
        nombreCompleto: dto.nombreCompleto ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionCasaMatriz: dto.direccionCasaMatriz ?? undefined,
        slug: dto.slug ?? undefined,
        paymentMethods: dto.paymentMethods ?? undefined,
        bines: dto.bines ?? undefined,
        fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
        logoUrl: dto.logoUrl ?? undefined,
        activo: dto.activo ?? undefined,
      },
    });

    await this.audit.log({
      tenantId: bankId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Bank',
      entityId: bankId,
      before: {
        nombre: before.nombre,
        nombreCompleto: before.nombreCompleto,
        razonSocial: before.razonSocial,
        cuit: before.cuit,
        direccionCasaMatriz: before.direccionCasaMatriz,
        slug: before.slug,
        paymentMethods: before.paymentMethods,
        bines: before.bines,
        fechaAlta: before.fechaAlta,
        logoUrl: before.logoUrl,
        activo: before.activo,
      },
      after: {
        nombre: updated.nombre,
        nombreCompleto: updated.nombreCompleto,
        razonSocial: updated.razonSocial,
        cuit: updated.cuit,
        direccionCasaMatriz: updated.direccionCasaMatriz,
        slug: updated.slug,
        paymentMethods: updated.paymentMethods,
        bines: updated.bines,
        fechaAlta: updated.fechaAlta,
        logoUrl: updated.logoUrl,
        activo: updated.activo,
      },
    });

    return updated;
  }

  async remove(bankId: string, actorId?: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, nombre: true, slug: true },
    });
    if (!bank) {
      throw new NotFoundException('Banco no encontrado');
    }

    const counts = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: {
        _count: {
          select: {
            users: true,
            bankBranches: true,
            merchants: true,
            branches: true,
            campaigns: true,
            invitations: true,
            validations: true,
            notifications: true,
            auditLogs: true,
          },
        },
      },
    });

    const totalRelations = Object.values(counts?._count ?? {}).reduce((acc, value) => acc + value, 0);
    if (totalRelations > 0) {
      throw new BadRequestException('No se puede borrar un banco con datos asociados. Desactivalo primero.');
    }

    await this.prisma.bank.delete({ where: { id: bankId } });

    return { ok: true };
  }
}
