import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Prisma, Role } from '@prisma/client';
import { isCentralPlatformMode } from '../common/platform-mode';

const bankBranchRoles = new Set<Role>([Role.BANK_BRANCH_MANAGER, Role.BANK_BRANCH_OPERATOR]);
const brandRoles = new Set<Role>([Role.BRAND_ADMIN]);
const legalEntityRoles = new Set<Role>([Role.LEGAL_ENTITY_ADMIN, Role.MERCHANT_ADMIN, Role.MERCHANT_USER]);
const pointOfSaleRoles = new Set<Role>([Role.POS_ADMIN]);
const bankWideRoles = new Set<Role>([
  Role.SUPERADMIN,
  Role.BANK_ADMIN,
  Role.BANK_OPS,
  Role.BANK_APPROVER,
  Role.ADMIN,
  Role.OPERATIONS,
]);

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async buildScopeWhere(
    tenantId: string,
    scope?: {
      role: Role;
      bankBranchId?: string | null;
      merchantId?: string | null;
      brandId?: string | null;
      pointOfSaleId?: string | null;
    },
  ): Promise<Prisma.UserWhereInput> {
    if (scope?.role === Role.SUPERADMIN && isCentralPlatformMode()) {
      return { tenantId, role: Role.SUPERADMIN };
    }
    if (!scope || bankWideRoles.has(scope.role)) {
      return { tenantId };
    }

    if (bankBranchRoles.has(scope.role)) {
      if (!scope.bankBranchId) {
        return { tenantId, id: '__no_branch__' };
      }
      return { tenantId, bankBranchId: scope.bankBranchId };
    }

    if (brandRoles.has(scope.role)) {
      if (!scope.brandId) {
        return { tenantId, id: '__no_brand__' };
      }
      const links = await this.prisma.brandLegalEntity.findMany({
        where: { tenantId, brandId: scope.brandId },
        select: { merchantId: true },
      });
      const merchantIds = links.map((link) => link.merchantId);
      const branchIds = merchantIds.length
        ? (
            await this.prisma.branch.findMany({
              where: { tenantId, merchantId: { in: merchantIds } },
              select: { id: true },
            })
          ).map((branch) => branch.id)
        : [];
      return {
        tenantId,
        OR: [
          { brandId: scope.brandId },
          ...(merchantIds.length ? [{ merchantId: { in: merchantIds } }] : []),
          ...(branchIds.length ? [{ pointOfSaleId: { in: branchIds } }] : []),
        ],
      };
    }

    if (legalEntityRoles.has(scope.role)) {
      if (!scope.merchantId) {
        return { tenantId, id: '__no_merchant__' };
      }
      const branchIds = (
        await this.prisma.branch.findMany({
          where: { tenantId, merchantId: scope.merchantId },
          select: { id: true },
        })
      ).map((branch) => branch.id);
      return {
        tenantId,
        OR: [
          { merchantId: scope.merchantId },
          ...(branchIds.length ? [{ pointOfSaleId: { in: branchIds } }] : []),
        ],
      };
    }

    if (pointOfSaleRoles.has(scope.role)) {
      if (!scope.pointOfSaleId) {
        return { tenantId, id: '__no_pos__' };
      }
      return { tenantId, pointOfSaleId: scope.pointOfSaleId };
    }

    return { tenantId, id: '__restricted__' };
  }

  async list(
    tenantId: string,
    scope?: {
      role: Role;
      bankBranchId?: string | null;
      merchantId?: string | null;
      brandId?: string | null;
      pointOfSaleId?: string | null;
    },
  ) {
    const where = await this.buildScopeWhere(tenantId, scope);
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        brandId: true,
        merchantId: true,
        bankBranchId: true,
        pointOfSaleId: true,
        brand: { select: { id: true, nombre: true } },
        bank: { select: { id: true, nombre: true, slug: true } },
        bankBranch: { select: { id: true, nombre: true, codigo: true, localidad: true } },
        merchant: {
          select: {
            id: true,
            nombre: true,
            cuit: true,
            brands: {
              select: {
                brand: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        pointOfSale: { select: { id: true, nombre: true, direccion: true, ciudad: true } },
        isActive: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(
    tenantId: string,
    id: string,
    scope?: {
      role: Role;
      bankBranchId?: string | null;
      merchantId?: string | null;
      brandId?: string | null;
      pointOfSaleId?: string | null;
    },
  ) {
    const whereScope = await this.buildScopeWhere(tenantId, scope);
    const user = await this.prisma.user.findFirst({
      where: { AND: [whereScope, { id }] },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        brandId: true,
        merchantId: true,
        bankBranchId: true,
        pointOfSaleId: true,
        brand: { select: { id: true, nombre: true } },
        bank: { select: { id: true, nombre: true, slug: true } },
        bankBranch: { select: { id: true, nombre: true, codigo: true, localidad: true } },
        merchant: {
          select: {
            id: true,
            nombre: true,
            cuit: true,
            brands: {
              select: {
                brand: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        pointOfSale: { select: { id: true, nombre: true, direccion: true, ciudad: true } },
        isActive: true,
        lastLoginAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserDto,
    actorScope?: {
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
    actorId?: string,
    actorRole?: Role,
  ) {
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('No autorizado para asignar SuperAdmin');
    }
    if (
      actorScope &&
      (!bankWideRoles.has(actorScope.role) || (actorScope.role === Role.SUPERADMIN && isCentralPlatformMode()))
    ) {
      const scopeWhere = await this.buildScopeWhere(tenantId, actorScope);
      const allowed = await this.prisma.user.findFirst({
        where: { AND: [scopeWhere, { id }] },
        select: { id: true },
      });
      if (!allowed) {
        throw new ForbiddenException('No autorizado para editar este usuario');
      }
    }
    const before = await this.prisma.user.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const normalizedBankBranchId = dto.bankBranchId === '' ? null : dto.bankBranchId;
    const normalizedBrandId = dto.brandId === '' ? null : dto.brandId;
    const normalizedMerchantId = dto.merchantId === '' ? null : dto.merchantId;
    const normalizedPointOfSaleId = dto.pointOfSaleId === '' ? null : dto.pointOfSaleId;

    const effectiveRole = dto.role ?? before.role;
    const isBranchRole = bankBranchRoles.has(effectiveRole);
    const isBrandRole = brandRoles.has(effectiveRole);
    const isLegalEntityRole = legalEntityRoles.has(effectiveRole);
    const isPointOfSaleRole = pointOfSaleRoles.has(effectiveRole);

    if (isBranchRole) {
      const branchId = normalizedBankBranchId ?? before.bankBranchId;
      if (!branchId) {
        throw new ForbiddenException('La sucursal bancaria es obligatoria para este rol');
      }
    } else if (normalizedBankBranchId) {
      throw new ForbiddenException('La sucursal bancaria solo aplica a roles de sucursal');
    }

    if (isBrandRole) {
      const brandId = normalizedBrandId ?? before.brandId;
      if (!brandId) {
        throw new ForbiddenException('La marca es obligatoria para este rol');
      }
    } else if (normalizedBrandId) {
      throw new ForbiddenException('La marca solo aplica a roles de marca');
    }

    if (isLegalEntityRole) {
      const merchantId = normalizedMerchantId ?? before.merchantId;
      if (!merchantId) {
        throw new ForbiddenException('La razon social es obligatoria para este rol');
      }
    } else if (normalizedMerchantId && !isPointOfSaleRole) {
      throw new ForbiddenException('La razon social solo aplica a roles comerciales');
    }

    if (isPointOfSaleRole) {
      const posId = normalizedPointOfSaleId ?? before.pointOfSaleId;
      if (!posId) {
        throw new ForbiddenException('El punto de venta es obligatorio para este rol');
      }
    } else if (normalizedPointOfSaleId) {
      throw new ForbiddenException('El punto de venta solo aplica a roles de PDV');
    }

    if (normalizedBankBranchId) {
      const branch = await this.prisma.bankBranch.findUnique({ where: { id: normalizedBankBranchId } });
      if (!branch || branch.bankId !== tenantId) {
        throw new ForbiddenException('Sucursal bancaria invalida');
      }
    }
    if (normalizedBrandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: normalizedBrandId } });
      if (!brand || brand.tenantId !== tenantId) {
        throw new ForbiddenException('Marca invalida');
      }
    }
    if (normalizedMerchantId) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: normalizedMerchantId } });
      if (!merchant || merchant.tenantId !== tenantId) {
        throw new ForbiddenException('Razon social invalida');
      }
    }

    let resolvedMerchantId = normalizedMerchantId ?? before.merchantId ?? null;
    if (isPointOfSaleRole) {
      const posId = normalizedPointOfSaleId ?? before.pointOfSaleId;
      const pointOfSale = posId
        ? await this.prisma.branch.findUnique({ where: { id: posId } })
        : null;
      if (!pointOfSale || pointOfSale.tenantId !== tenantId) {
        throw new ForbiddenException('Punto de venta invalido');
      }
      if (normalizedMerchantId && normalizedMerchantId !== pointOfSale.merchantId) {
        throw new ForbiddenException('El punto de venta no pertenece a la razon social indicada');
      }
      resolvedMerchantId = pointOfSale.merchantId;
    }

    let bankBranchIdToSet: string | null | undefined;
    if (isBranchRole) {
      bankBranchIdToSet = normalizedBankBranchId ?? before.bankBranchId ?? undefined;
    } else if (dto.role && !isBranchRole) {
      bankBranchIdToSet = null;
    } else if (normalizedBankBranchId !== undefined) {
      bankBranchIdToSet = normalizedBankBranchId;
    }

    let brandIdToSet: string | null | undefined;
    if (isBrandRole) {
      brandIdToSet = normalizedBrandId ?? before.brandId ?? undefined;
    } else if (dto.role && !isBrandRole) {
      brandIdToSet = null;
    } else if (normalizedBrandId !== undefined) {
      brandIdToSet = normalizedBrandId;
    }

    let merchantIdToSet: string | null | undefined;
    if (isLegalEntityRole || isPointOfSaleRole) {
      merchantIdToSet = resolvedMerchantId ?? undefined;
    } else if (dto.role && !isLegalEntityRole && !isPointOfSaleRole) {
      merchantIdToSet = null;
    } else if (normalizedMerchantId !== undefined) {
      merchantIdToSet = normalizedMerchantId;
    }

    let pointOfSaleIdToSet: string | null | undefined;
    if (isPointOfSaleRole) {
      pointOfSaleIdToSet = normalizedPointOfSaleId ?? before.pointOfSaleId ?? undefined;
    } else if (dto.role && !isPointOfSaleRole) {
      pointOfSaleIdToSet = null;
    } else if (normalizedPointOfSaleId !== undefined) {
      pointOfSaleIdToSet = normalizedPointOfSaleId;
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
          brandId: brandIdToSet,
          merchantId: merchantIdToSet,
          bankBranchId: bankBranchIdToSet,
          pointOfSaleId: pointOfSaleIdToSet,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          role: true,
          brandId: true,
          merchantId: true,
          bankBranchId: true,
          pointOfSaleId: true,
          brand: { select: { id: true, nombre: true } },
          bank: { select: { id: true, nombre: true, slug: true } },
          bankBranch: { select: { id: true, nombre: true, codigo: true, localidad: true } },
          merchant: {
            select: {
              id: true,
              nombre: true,
              cuit: true,
              brands: {
                select: {
                  brand: { select: { id: true, nombre: true } },
                },
              },
            },
          },
          pointOfSale: { select: { id: true, nombre: true, direccion: true, ciudad: true } },
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

  async deactivate(
    tenantId: string,
    id: string,
    actorScope?: {
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
    actorId?: string,
  ) {
    if (
      actorScope &&
      (!bankWideRoles.has(actorScope.role) || (actorScope.role === Role.SUPERADMIN && isCentralPlatformMode()))
    ) {
      const scopeWhere = await this.buildScopeWhere(tenantId, actorScope);
      const allowed = await this.prisma.user.findFirst({
        where: { AND: [scopeWhere, { id }] },
        select: { id: true },
      });
      if (!allowed) {
        throw new ForbiddenException('No autorizado para desactivar este usuario');
      }
    }
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
        const brandId = row.brandId || undefined;
        const pointOfSaleId = row.pointOfSaleId || undefined;
        if (branchRoles.includes(role) && !bankBranchId) {
          throw new Error('bankBranchId requerido para roles de sucursal');
        }
        if (bankBranchId) {
          const branch = await this.prisma.bankBranch.findUnique({ where: { id: bankBranchId } });
          if (!branch || branch.bankId !== tenantId) {
            throw new Error('bankBranchId no pertenece al banco');
          }
        }
        if (brandRoles.has(role) && !brandId) {
          throw new Error('brandId requerido para roles de marca');
        }
        if (brandId) {
          const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
          if (!brand || brand.tenantId !== tenantId) {
            throw new Error('brandId no pertenece al banco');
          }
        }
        let resolvedMerchantId = row.merchantId || undefined;
        if (legalEntityRoles.has(role) && !resolvedMerchantId) {
          throw new Error('merchantId requerido para roles de razon social');
        }
        if (resolvedMerchantId) {
          const merchant = await this.prisma.merchant.findUnique({ where: { id: resolvedMerchantId } });
          if (!merchant || merchant.tenantId !== tenantId) {
            throw new Error('merchantId no pertenece al banco');
          }
        }
        if (pointOfSaleRoles.has(role) && !pointOfSaleId) {
          throw new Error('pointOfSaleId requerido para roles de PDV');
        }
        if (pointOfSaleId) {
          const pos = await this.prisma.branch.findUnique({ where: { id: pointOfSaleId } });
          if (!pos || pos.tenantId !== tenantId) {
            throw new Error('pointOfSaleId no pertenece al banco');
          }
          if (resolvedMerchantId && resolvedMerchantId !== pos.merchantId) {
            throw new Error('pointOfSaleId no corresponde al merchantId');
          }
          resolvedMerchantId = pos.merchantId;
        }

        const passwordHash = await import('bcryptjs').then((mod) => mod.default.hash(password, 10));
        await this.prisma.user.create({
          data: {
            tenantId,
            email,
            passwordHash,
            nombre,
            role,
            brandId: brandRoles.has(role) ? brandId ?? null : null,
            merchantId: legalEntityRoles.has(role) || pointOfSaleRoles.has(role) ? resolvedMerchantId ?? null : null,
            bankBranchId: bankBranchId ?? null,
            pointOfSaleId: pointOfSaleRoles.has(role) ? pointOfSaleId ?? null : null,
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
