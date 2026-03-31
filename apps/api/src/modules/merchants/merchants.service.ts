import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, CardNetwork, MerchantStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(tenantId: string, filters?: { estado?: MerchantStatus; categoria?: string }) {
    return this.prisma.merchant.findMany({
      where: {
        tenantId,
        estado: filters?.estado,
        categoria: filters?.categoria,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByBrand(tenantId: string, brandId: string, filters?: { estado?: MerchantStatus; categoria?: string }) {
    return this.prisma.merchant.findMany({
      where: {
        tenantId,
        estado: filters?.estado,
        categoria: filters?.categoria,
        brands: {
          some: {
            brandId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isMerchantInBrand(tenantId: string, brandId: string, merchantId: string) {
    const link = await this.prisma.brandLegalEntity.findFirst({
      where: { tenantId, brandId, merchantId },
      select: { id: true },
    });
    return Boolean(link);
  }

  async get(tenantId: string, id: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { tenantId, id },
      include: {
        branches: {
          include: { shopping: true, establishments: true },
        },
        brands: { include: { brand: true } },
      },
    });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }
    return merchant;
  }

  async create(tenantId: string, dto: CreateMerchantDto, actorId?: string) {
    const uniqueBrandIds = dto.brandIds ? Array.from(new Set(dto.brandIds)) : [];
    if (uniqueBrandIds.length) {
      const brands = await this.prisma.brand.findMany({
        where: { tenantId, id: { in: uniqueBrandIds } },
        select: { id: true },
      });
      if (brands.length !== uniqueBrandIds.length) {
        throw new BadRequestException('Marca invalida');
      }
    }
    const merchant = await this.prisma.merchant.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        razonSocial: dto.razonSocial,
        categoria: dto.categoria,
        estado: dto.estado ?? MerchantStatus.PENDING,
        cuit: dto.cuit,
        direccionSocial: dto.direccionSocial,
        merchantNumber: dto.merchantNumber,
        contactoEmail: dto.contactoEmail,
        telefono: dto.telefono,
        processor: dto.processor,
      },
    });

    if (uniqueBrandIds.length) {
      await this.prisma.brandLegalEntity.createMany({
        data: uniqueBrandIds.map((brandId) => ({
          tenantId,
          brandId,
          merchantId: merchant.id,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.CREATE,
      entity: 'Merchant',
      entityId: merchant.id,
      after: {
        nombre: merchant.nombre,
        razonSocial: merchant.razonSocial,
        cuit: merchant.cuit,
        estado: merchant.estado,
        merchantNumber: merchant.merchantNumber,
        processor: merchant.processor,
      },
    });

    return merchant;
  }

  async update(tenantId: string, id: string, dto: UpdateMerchantDto, actorId?: string) {
    const before = await this.prisma.merchant.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Comercio no encontrado');
    }
    const uniqueBrandIds = dto.brandIds ? Array.from(new Set(dto.brandIds)) : [];
    if (dto.brandIds) {
      const brands = await this.prisma.brand.findMany({
        where: { tenantId, id: { in: uniqueBrandIds } },
        select: { id: true },
      });
      if (brands.length !== uniqueBrandIds.length) {
        throw new BadRequestException('Marca invalida');
      }
    }
    const merchant = await this.prisma.merchant.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        categoria: dto.categoria ?? undefined,
        estado: dto.estado ?? undefined,
        cuit: dto.cuit ?? undefined,
        direccionSocial: dto.direccionSocial ?? undefined,
        merchantNumber: dto.merchantNumber ?? undefined,
        contactoEmail: dto.contactoEmail ?? undefined,
        telefono: dto.telefono ?? undefined,
        processor: dto.processor ?? undefined,
      },
    });

    if (dto.brandIds) {
      await this.prisma.brandLegalEntity.deleteMany({
        where: { tenantId, merchantId: id },
      });
      if (uniqueBrandIds.length) {
        await this.prisma.brandLegalEntity.createMany({
          data: uniqueBrandIds.map((brandId) => ({
            tenantId,
            brandId,
            merchantId: id,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'Merchant',
      entityId: merchant.id,
      before: {
        nombre: before.nombre,
        razonSocial: before.razonSocial,
        cuit: before.cuit,
        estado: before.estado,
        merchantNumber: before.merchantNumber,
        processor: before.processor,
      },
      after: {
        nombre: merchant.nombre,
        razonSocial: merchant.razonSocial,
        cuit: merchant.cuit,
        estado: merchant.estado,
        merchantNumber: merchant.merchantNumber,
        processor: merchant.processor,
      },
    });

    return merchant;
  }

  async remove(tenantId: string, id: string, actorId?: string) {
    const before = await this.prisma.merchant.findFirst({ where: { tenantId, id } });
    if (!before) {
      throw new NotFoundException('Comercio no encontrado');
    }
    await this.prisma.merchant.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actorId ?? null,
      action: AuditAction.DELETE,
      entity: 'Merchant',
      entityId: id,
      before: { nombre: before.nombre, estado: before.estado },
    });

    return { ok: true };
  }

  async importCsv(tenantId: string, csv: Buffer, actorId?: string) {
    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const created = [] as string[];
    const brandCache = new Map<string, { id: string; processor?: string | null }>();
    const merchantCache = new Map<string, { id: string; processor?: string | null }>();
    const shoppingCache = new Map<string, { id: string }>();

    const normalizeHeader = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    for (const row of rows) {
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
      );
      const getValue = (keys: string[]) => {
        for (const key of keys) {
          const value = normalizedRow[key];
          if (value && value.toString().trim() !== '') {
            return value.toString().trim();
          }
        }
        return '';
      };

      const razonSocial = getValue(['razonsocial']);
      const nombreFantasia = getValue(['nombredefantasia', 'nombrefantasia']);
      const email = getValue(['email', 'correo', 'mail']);
      const telefono = getValue(['telefono', 'tel']);
      const calle = getValue(['calle']);
      const numero = getValue(['nro', 'numero', 'altura']);
      const piso = getValue(['pisodeptolocal', 'pisolocal', 'piso']);
      const provincia = getValue(['provincia', 'estado']);
      const ciudad = getValue(['ciudad', 'localidad']);
      const codigoPostal = getValue(['codigopostal', 'cp']);
      const shoppingName = getValue(['shopping']);
      const adquirente = getValue(['adquirente', 'procesador', 'processor']);
      const nroComercio = getValue(['nrodecomercio', 'numerodecomercio', 'merchantnumber', 'mid']);
      const nroEstablecimiento = getValue(['nrodeestablecimiento', 'numerodeestablecimiento', 'establecimiento']);

      const cuitRaw = getValue(['cuit']);
      const cuit = cuitRaw ? cuitRaw.replace(/\D/g, '') : '';

      const brandName = nombreFantasia || razonSocial || 'Sin marca';
      const brandKey = brandName.toLowerCase();
      let brand = brandCache.get(brandKey);
      if (!brand) {
        const existingBrand = await this.prisma.brand.findFirst({
          where: { tenantId, nombre: { equals: brandName, mode: 'insensitive' } },
          select: { id: true, processor: true },
        });
        if (existingBrand) {
          brand = { id: existingBrand.id, processor: existingBrand.processor };
        } else {
          const createdBrand = await this.prisma.brand.create({
            data: {
              tenantId,
              nombre: brandName,
              processor: adquirente || undefined,
              activo: true,
            },
            select: { id: true, processor: true },
          });
          brand = { id: createdBrand.id, processor: createdBrand.processor };
        }
        brandCache.set(brandKey, brand);
      }

      if (adquirente && !brand.processor) {
        await this.prisma.brand.update({
          where: { id: brand.id },
          data: { processor: adquirente },
        });
        brand.processor = adquirente;
      }

      const merchantKey = cuit ? `cuit:${cuit}` : `razon:${razonSocial || brandName}`.toLowerCase();
      let merchant = merchantCache.get(merchantKey);
      if (!merchant) {
        const existingMerchant = cuit
          ? await this.prisma.merchant.findFirst({
              where: { tenantId, cuit },
              select: { id: true, processor: true },
            })
          : razonSocial
            ? await this.prisma.merchant.findFirst({
                where: { tenantId, razonSocial: { equals: razonSocial, mode: 'insensitive' } },
                select: { id: true, processor: true },
              })
            : null;

        if (existingMerchant) {
          merchant = { id: existingMerchant.id, processor: existingMerchant.processor };
        } else {
          const createdMerchant = await this.prisma.merchant.create({
            data: {
              tenantId,
              nombre: razonSocial || brandName,
              razonSocial: razonSocial || undefined,
              categoria: 'Sin categoria',
              estado: MerchantStatus.PENDING,
              cuit: cuit || undefined,
              direccionSocial:
                calle || numero || ciudad || provincia
                  ? [calle, numero, piso, ciudad, provincia].filter(Boolean).join(' ')
                  : undefined,
              merchantNumber: nroComercio || undefined,
              contactoEmail: email || undefined,
              telefono: telefono || undefined,
              processor: adquirente || undefined,
            },
            select: { id: true },
          });
          merchant = { id: createdMerchant.id, processor: adquirente || undefined };

          await this.audit.log({
            tenantId,
            userId: actorId ?? null,
            action: AuditAction.CREATE,
            entity: 'Merchant',
            entityId: createdMerchant.id,
            after: { nombre: razonSocial || brandName, estado: MerchantStatus.PENDING },
          });
        }
        merchantCache.set(merchantKey, merchant);
      }

      if (adquirente && !merchant.processor) {
        await this.prisma.merchant.update({
          where: { id: merchant.id },
          data: { processor: adquirente },
        });
        merchant.processor = adquirente;
      }

      await this.prisma.brandLegalEntity.createMany({
        data: [{ tenantId, brandId: brand.id, merchantId: merchant.id }],
        skipDuplicates: true,
      });

      let shoppingId: string | undefined;
      if (shoppingName) {
        const shoppingKey = shoppingName.toLowerCase();
        let shopping = shoppingCache.get(shoppingKey);
        if (!shopping) {
          const existingShopping = await this.prisma.shopping.findFirst({
            where: { tenantId, nombre: { equals: shoppingName, mode: 'insensitive' } },
            select: { id: true },
          });
          if (existingShopping) {
            shopping = { id: existingShopping.id };
          } else {
            const createdShopping = await this.prisma.shopping.create({
              data: { tenantId, nombre: shoppingName, activo: true },
              select: { id: true },
            });
            shopping = { id: createdShopping.id };
          }
          shoppingCache.set(shoppingKey, shopping);
        }
        shoppingId = shopping.id;
      }

      const direccion = [calle, numero, piso].filter(Boolean).join(' ').trim();
      const branchNombre = [brandName, ciudad].filter(Boolean).join(' - ') || 'Sucursal';
      const branch = await this.prisma.branch.create({
        data: {
          tenantId,
          merchantId: merchant.id,
          nombre: branchNombre,
          direccion: direccion || 'Sin direccion',
          calle: calle || undefined,
          numero: numero || undefined,
          piso: piso || undefined,
          codigoPostal: codigoPostal || undefined,
          ciudad: ciudad || 'Sin ciudad',
          provincia: provincia || 'Sin provincia',
          pais: 'Argentina',
          merchantNumber: nroEstablecimiento || undefined,
          shoppingId,
        },
        select: { id: true },
      });

      if (nroEstablecimiento) {
        await this.prisma.branchEstablishment.upsert({
          where: {
            branchId_cardNetwork: {
              branchId: branch.id,
              cardNetwork: CardNetwork.OTRA,
            },
          },
          update: { number: nroEstablecimiento },
          create: {
            tenantId,
            branchId: branch.id,
            cardNetwork: CardNetwork.OTRA,
            number: nroEstablecimiento,
          },
        });
      }

      created.push(branch.id);
    }

    return { created: created.length };
  }

  async exportCsv(tenantId: string) {
    const merchants = await this.prisma.merchant.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'nombre,categoria,estado,cuit,merchantNumber,contactoEmail,telefono';
    const lines = merchants.map((m) =>
      [
        m.nombre,
        m.categoria,
        m.estado,
        m.cuit ?? '',
        m.merchantNumber ?? '',
        m.contactoEmail ?? '',
        m.telefono ?? '',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }
}
