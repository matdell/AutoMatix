import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Prisma, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        merchantId: true,
        bankBranchId: true,
        bank: { select: { id: true, nombre: true, slug: true } },
        bankBranch: { select: { id: true, nombre: true, codigo: true, localidad: true } },
        isActive: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        merchantId: true,
        bankBranchId: true,
        bank: { select: { id: true, nombre: true, slug: true } },
        bankBranch: { select: { id: true, nombre: true, codigo: true, localidad: true } },
        isActive: true,
        lastLoginAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, actorId?: string, actorRole?: Role) {
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('No autorizado para asignar SuperAdmin');
    }
    const before = await this.prisma.user.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const branchRoles: Role[] = [Role.BANK_BRANCH_MANAGER, Role.BANK_BRANCH_OPERATOR];
    const normalizedBankBranchId =
      dto.bankBranchId === '' ? null : dto.bankBranchId;
    const effectiveRole = dto.role ?? before.role;
    if (branchRoles.includes(effectiveRole)) {
      const branchId = normalizedBankBranchId ?? before.bankBranchId;
      if (!branchId) {
        throw new ForbiddenException('La sucursal bancaria es obligatoria para este rol');
      }
      if (normalizedBankBranchId) {
        const branch = await this.prisma.bankBranch.findUnique({ where: { id: normalizedBankBranchId } });
        if (!branch || branch.bankId !== tenantId) {
          throw new ForbiddenException('Sucursal bancaria invalida');
        }
      }
    } else {
      if (normalizedBankBranchId) {
        throw new ForbiddenException('La sucursal bancaria solo aplica a roles de sucursal');
      }
    }
    let bankBranchIdToSet: string | null | undefined;
    if (branchRoles.includes(effectiveRole)) {
      bankBranchIdToSet = normalizedBankBranchId ?? before.bankBranchId ?? undefined;
    } else if (dto.role && !branchRoles.includes(dto.role)) {
      bankBranchIdToSet = null;
    } else if (normalizedBankBranchId !== undefined) {
      bankBranchIdToSet = normalizedBankBranchId;
    }
    let updated;
    try {
      updated = await this.prisma.user.update({
        where: { id },
        data: {
          nombre: dto.nombre ?? undefined,
          email: dto.email ? dto.email.toLowerCase() : undefined,
          role: dto.role ?? undefined,
          isActive: dto.isActive ?? undefined,
          merchantId: dto.merchantId ?? undefined,
          bankBranchId: bankBranchIdToSet,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          role: true,
          merchantId: true,
          bankBranchId: true,
          bank: { select: { id: true, nombre: true, slug: true } },
          bankBranch: { select: { id: true, nombre: true, codigo: true, localidad: true } },
          isActive: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('El email ya esta en uso');
      }
      throw err;
    }

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      before: { nombre: before.nombre, role: before.role, isActive: before.isActive },
      after: { nombre: updated.nombre, role: updated.role, isActive: updated.isActive },
    });

    return updated;
  }

  async deactivate(tenantId: string, id: string, actorId?: string) {
    const before = await this.prisma.user.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, nombre: true, email: true, role: true, isActive: true },
    });
    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: updated.isActive },
    });
    return updated;
  }

  async importCsv(tenantId: string, buffer: Buffer, actorId?: string) {
    const { parse } = await import('csv-parse/sync');
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const legacyRoleMap: Record<string, Role> = {
      ADMIN: Role.BANK_ADMIN,
      OPERATIONS: Role.BANK_OPS,
      MERCHANT: Role.MERCHANT_USER,
    };
    const branchRoles: Role[] = [Role.BANK_BRANCH_MANAGER, Role.BANK_BRANCH_OPERATOR];

    let created = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < records.length; i += 1) {
      const row = records[i];
      try {
        const email = row.email?.toLowerCase();
        const nombre = row.nombre || row.name;
        const password = row.password;
        const rawRole = (row.role || '').toUpperCase();
        const role = legacyRoleMap[rawRole] || (rawRole as Role);

        if (!email || !nombre || !password || !rawRole) {
          throw new Error('Faltan campos obligatorios (nombre, email, password, role)');
        }

        if (!Object.values(Role).includes(role)) {
          throw new Error(`Rol invalido: ${row.role}`);
        }

        const bankBranchId = row.bankBranchId || undefined;
        if (branchRoles.includes(role) && !bankBranchId) {
          throw new Error('bankBranchId requerido para roles de sucursal');
        }
        if (bankBranchId) {
          const branch = await this.prisma.bankBranch.findUnique({ where: { id: bankBranchId } });
          if (!branch || branch.bankId !== tenantId) {
            throw new Error('bankBranchId no pertenece al banco');
          }
        }

        const passwordHash = await import('bcryptjs').then((mod) => mod.default.hash(password, 10));
        await this.prisma.user.create({
          data: {
            tenantId,
            email,
            passwordHash,
            nombre,
            role,
            merchantId: row.merchantId || null,
            bankBranchId: bankBranchId ?? null,
            isActive: true,
          },
        });
        created += 1;
      } catch (err) {
        errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : 'Error inesperado',
        });
      }
    }

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: 'bulk-import',
      after: { created, errors: errors.length },
    });

    return { created, errors };
  }
}
