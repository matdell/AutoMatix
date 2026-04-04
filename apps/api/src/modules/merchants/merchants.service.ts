import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, CardNetwork, MerchantStatus, Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';

type MerchantRetailerCacheValue = string | '__NONE__' | '__MULTI__';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async resolveMerchantCategory(tenantId: string, categoriaRaw: string) {
    const categoria = categoriaRaw.trim();
    if (!categoria) {
      throw new BadRequestException('La categoria es obligatoria');
    }
    const category = await this.prisma.category.findFirst({
      where: {
        tenantId,
        nombre: { equals: categoria, mode: 'insensitive' },
      },
      select: { nombre: true, activo: true },
    });
    if (!category) {
      throw new BadRequestException('Categoria invalida');
    }
    if (!category.activo) {
      throw new BadRequestException('La categoria seleccionada esta inactiva');
    }
    return category.nombre;
  }

  async list(tenantId: string, filters?: { estado?: MerchantStatus; categoria?: string }) {
    return this.prisma.merchant.findMany({
      where: {
        tenantId,
        estado: filters?.estado,
        categoria: filters?.categoria,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        brands: {
          include: {
            brand: {
              select: {
                id: true,
                nombre: true,
                activo: true,
              },
            },
          },
        },
      },
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
      include: {
        brands: {
          include: {
            brand: {
              select: {
                id: true,
                nombre: true,
                activo: true,
              },
            },
          },
        },
      },
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
          include: {
            shopping: true,
            establishments: true,
            retailer: {
              select: {
                id: true,
                nombre: true,
                logoUrl: true,
                sitioWeb: true,
                emailPrincipal: true,
                telefonoPrincipal: true,
                activo: true,
              },
            },
          },
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
    const categoria = await this.resolveMerchantCategory(tenantId, dto.categoria);
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
        categoria,
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
    const categoria =
      dto.categoria !== undefined
        ? await this.resolveMerchantCategory(tenantId, dto.categoria)
        : undefined;
    const merchant = await this.prisma.merchant.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        razonSocial: dto.razonSocial ?? undefined,
        categoria,
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
          retailerId: brand.id,
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

  private normalizeHeader(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private getValueFromNormalizedRow(normalizedRow: Record<string, string>, keys: string[]) {
    for (const key of keys) {
      const value = normalizedRow[key];
      if (value && value.trim() !== '') {
        return value.trim();
      }
    }
    return '';
  }

  private csvEscape(value: unknown) {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private csvSerialize(headers: string[], rows: string[][]) {
    const headerLine = headers.map((header) => this.csvEscape(header)).join(',');
    const rowLines = rows.map((row) => row.map((cell) => this.csvEscape(cell)).join(','));
    return [headerLine, ...rowLines].join('\n');
  }

  private buildEstablishmentMap(
    establishments: Array<{ cardNetwork: CardNetwork; number: string }>,
  ) {
    const map = new Map<CardNetwork, string>();
    for (const item of establishments) {
      map.set(item.cardNetwork, item.number);
    }
    return map;
  }

  private async resolveRetailerIdForBranch(params: {
    tenantId: string;
    merchantId: string;
    explicitRetailerId?: string | null;
    fallbackRetailerId?: string | null;
    contextLabel?: string;
    singleRetailerCache?: Map<string, MerchantRetailerCacheValue>;
  }) {
    const explicitRetailerId = params.explicitRetailerId?.trim();
    if (explicitRetailerId) {
      const retailer = await this.prisma.brand.findFirst({
        where: { tenantId: params.tenantId, id: explicitRetailerId },
        select: { id: true },
      });
      if (!retailer) {
        throw new BadRequestException(`Retailer invalido para ${params.contextLabel ?? 'el PDV'}`);
      }
      const link = await this.prisma.brandLegalEntity.findFirst({
        where: {
          tenantId: params.tenantId,
          merchantId: params.merchantId,
          brandId: explicitRetailerId,
        },
        select: { id: true },
      });
      if (!link) {
        throw new BadRequestException(
          `El retailer indicado no esta vinculado a la razon social para ${params.contextLabel ?? 'el PDV'}`,
        );
      }
      return explicitRetailerId;
    }

    const fallbackRetailerId = params.fallbackRetailerId?.trim();
    if (fallbackRetailerId) {
      return fallbackRetailerId;
    }

    const cacheKey = `${params.tenantId}:${params.merchantId}`;
    const cached = params.singleRetailerCache?.get(cacheKey);
    if (cached) {
      if (cached === '__NONE__') {
        throw new BadRequestException(
          `No se puede asignar retailer a ${params.contextLabel ?? 'el PDV'}: la razon social no tiene retailers vinculados`,
        );
      }
      if (cached === '__MULTI__') {
        throw new BadRequestException(
          `No se puede asignar retailer a ${params.contextLabel ?? 'el PDV'}: la razon social tiene multiples retailers, informa brand_id`,
        );
      }
      return cached;
    }

    const links = await this.prisma.brandLegalEntity.findMany({
      where: { tenantId: params.tenantId, merchantId: params.merchantId },
      select: { brandId: true },
      take: 2,
    });
    if (links.length === 1) {
      params.singleRetailerCache?.set(cacheKey, links[0].brandId);
      return links[0].brandId;
    }
    if (links.length === 0) {
      params.singleRetailerCache?.set(cacheKey, '__NONE__');
      throw new BadRequestException(
        `No se puede asignar retailer a ${params.contextLabel ?? 'el PDV'}: la razon social no tiene retailers vinculados`,
      );
    }
    params.singleRetailerCache?.set(cacheKey, '__MULTI__');
    throw new BadRequestException(
      `No se puede asignar retailer a ${params.contextLabel ?? 'el PDV'}: la razon social tiene multiples retailers, informa brand_id`,
    );
  }

  async exportPortableCsv(params: {
    tenantId: string;
    includeBankSpecificData: boolean;
    brandId?: string;
    merchantId?: string;
  }) {
    const where: Prisma.MerchantWhereInput = {
      tenantId: params.tenantId,
    };
    if (params.merchantId) {
      where.id = params.merchantId;
    }
    if (params.brandId) {
      where.brands = {
        some: {
          brandId: params.brandId,
        },
      };
    }

    const merchants = await this.prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        brands: {
          include: {
            brand: true,
          },
        },
        branches: {
          include: {
            shopping: true,
            establishments: true,
            retailer: true,
          },
        },
      },
    });

    const baseHeaders = [
      'brand_id',
      'brand_nombre',
      'brand_logo_url',
      'brand_sitio_web',
      'brand_email',
      'brand_telefono',
      'merchant_id',
      'merchant_nombre',
      'merchant_razon_social',
      'merchant_cuit',
      'merchant_categoria',
      'merchant_email',
      'merchant_telefono',
      'merchant_direccion_social',
      'pdv_id',
      'pdv_nombre',
      'pdv_direccion',
      'pdv_calle',
      'pdv_numero',
      'pdv_piso',
      'pdv_ciudad',
      'pdv_provincia',
      'pdv_pais',
      'pdv_codigo_postal',
      'pdv_shopping',
    ];
    const bankSpecificHeaders = [
      'merchant_processor',
      'merchant_number',
      'pdv_processor',
      'pdv_merchant_number',
      'est_visa',
      'est_mastercard',
      'est_amex',
      'est_cabal',
      'est_naranja',
      'est_otra',
    ];
    const headers = params.includeBankSpecificData
      ? [...baseHeaders, ...bankSpecificHeaders]
      : baseHeaders;

    const rows: string[][] = [];

    for (const merchant of merchants) {
      const scopedBrands = merchant.brands
        .map((link) => link.brand)
        .filter((brand) => !params.brandId || brand.id === params.brandId);
      const branches = merchant.branches.filter(
        (branch) => !params.brandId || branch.retailerId === params.brandId,
      );

      if (branches.length === 0) {
        const brandsWithoutPdv = scopedBrands.length > 0 ? scopedBrands : [null];
        for (const brand of brandsWithoutPdv) {
          const row = [
            brand?.id ?? '',
            brand?.nombre ?? '',
            brand?.logoUrl ?? '',
            brand?.sitioWeb ?? '',
            brand?.emailPrincipal ?? '',
            brand?.telefonoPrincipal ?? '',
            merchant.id,
            merchant.nombre,
            merchant.razonSocial ?? '',
            merchant.cuit ?? '',
            merchant.categoria,
            merchant.contactoEmail ?? '',
            merchant.telefono ?? '',
            merchant.direccionSocial ?? '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ];
          if (params.includeBankSpecificData) {
            row.push(
              merchant.processor ?? '',
              merchant.merchantNumber ?? '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
            );
          }
          rows.push(row);
        }
        continue;
      }

      for (const branch of branches) {
        const brand = branch.retailer;
        const establishments = this.buildEstablishmentMap(branch.establishments);

        const row = [
          brand?.id ?? '',
          brand?.nombre ?? '',
          brand?.logoUrl ?? '',
          brand?.sitioWeb ?? '',
          brand?.emailPrincipal ?? '',
          brand?.telefonoPrincipal ?? '',
          merchant.id,
          merchant.nombre,
          merchant.razonSocial ?? '',
          merchant.cuit ?? '',
          merchant.categoria,
          merchant.contactoEmail ?? '',
          merchant.telefono ?? '',
          merchant.direccionSocial ?? '',
          branch.id,
          branch.nombre,
          branch.direccion,
          branch.calle ?? '',
          branch.numero ?? '',
          branch.piso ?? '',
          branch.ciudad,
          branch.provincia,
          branch.pais,
          branch.codigoPostal ?? '',
          branch.shopping?.nombre ?? '',
        ];

        if (params.includeBankSpecificData) {
          row.push(
            merchant.processor ?? '',
            merchant.merchantNumber ?? '',
            branch.processor ?? '',
            branch.merchantNumber ?? '',
            establishments.get(CardNetwork.VISA) ?? '',
            establishments.get(CardNetwork.MASTERCARD) ?? '',
            establishments.get(CardNetwork.AMEX) ?? '',
            establishments.get(CardNetwork.CABAL) ?? '',
            establishments.get(CardNetwork.NARANJA) ?? '',
            establishments.get(CardNetwork.OTRA) ?? '',
          );
        }

        rows.push(row);
      }
    }

    return this.csvSerialize(headers, rows);
  }

  async importPortableCsv(params: {
    tenantId: string;
    csv: Buffer;
    includeBankSpecificData: boolean;
    actorId?: string;
    brandId?: string;
    merchantId?: string;
  }) {
    const records = parse(params.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const result = {
      rows: records.length,
      createdBrands: 0,
      updatedBrands: 0,
      createdMerchants: 0,
      updatedMerchants: 0,
      createdBranches: 0,
      updatedBranches: 0,
      createdBrandLinks: 0,
      updatedEstablishments: 0,
    };

    const normalizedRecords = records.map((record) => {
      const normalized: Record<string, string> = {};
      Object.entries(record).forEach(([header, value]) => {
        normalized[this.normalizeHeader(header)] =
          typeof value === 'string' ? value.trim() : String(value ?? '').trim();
      });
      return normalized;
    });

    const scopedBrand = params.brandId
      ? await this.prisma.brand.findFirst({
          where: { tenantId: params.tenantId, id: params.brandId },
          select: { id: true },
        })
      : null;
    if (params.brandId && !scopedBrand) {
      throw new NotFoundException('Marca no encontrada para importar datos');
    }

    const scopedMerchant = params.merchantId
      ? await this.prisma.merchant.findFirst({
          where: { tenantId: params.tenantId, id: params.merchantId },
          select: { id: true },
        })
      : null;
    if (params.merchantId && !scopedMerchant) {
      throw new NotFoundException('Razon social no encontrada para importar datos');
    }

    const shoppingCache = new Map<string, string>();
    const brandCacheByName = new Map<string, string>();
    const merchantCacheByKey = new Map<string, string>();
    const merchantRetailerCache = new Map<string, MerchantRetailerCacheValue>();
    const linkedPairs = new Set<string>();

    for (const row of normalizedRecords) {
      const brandIdFromRow = this.getValueFromNormalizedRow(row, ['brandid']);
      const brandName = this.getValueFromNormalizedRow(row, [
        'brandnombre',
        'marca',
        'nombrefantasia',
        'nombredefantasia',
      ]);
      const brandLogoUrl = this.getValueFromNormalizedRow(row, ['brandlogourl']);
      const brandWebsite = this.getValueFromNormalizedRow(row, ['brandsitioweb']);
      const brandEmail = this.getValueFromNormalizedRow(row, ['brandemail', 'brandemailprincipal']);
      const brandPhone = this.getValueFromNormalizedRow(row, ['brandtelefono', 'brandtelefonoprincipal']);
      const brandProcessor = this.getValueFromNormalizedRow(row, ['brandprocessor', 'adquirente']);

      const merchantIdFromRow = this.getValueFromNormalizedRow(row, ['merchantid']);
      const merchantName = this.getValueFromNormalizedRow(row, ['merchantnombre']);
      const merchantRazonSocial = this.getValueFromNormalizedRow(row, [
        'merchantrazonsocial',
        'razonsocial',
      ]);
      const merchantCuitRaw = this.getValueFromNormalizedRow(row, ['merchantcuit', 'cuit']);
      const merchantCuit = merchantCuitRaw ? merchantCuitRaw.replace(/\D/g, '') : '';
      const merchantCategoria = this.getValueFromNormalizedRow(row, ['merchantcategoria', 'categoria']);
      const merchantEmail = this.getValueFromNormalizedRow(row, ['merchantemail', 'email']);
      const merchantPhone = this.getValueFromNormalizedRow(row, ['merchanttelefono', 'telefono']);
      const merchantAddress = this.getValueFromNormalizedRow(row, [
        'merchantdireccionsocial',
        'direccionsocial',
      ]);
      const merchantProcessor = this.getValueFromNormalizedRow(row, [
        'merchantprocessor',
        'procesador',
        'adquirente',
      ]);
      const merchantNumber = this.getValueFromNormalizedRow(row, [
        'merchantnumber',
        'nrodecomercio',
        'numerodecomercio',
      ]);

      const pdvIdFromRow = this.getValueFromNormalizedRow(row, ['pdvid', 'branchid']);
      const pdvName = this.getValueFromNormalizedRow(row, ['pdvnombre', 'branchnombre', 'sucursal']);
      const pdvAddress = this.getValueFromNormalizedRow(row, ['pdvdireccion', 'branchdireccion', 'direccion']);
      const pdvStreet = this.getValueFromNormalizedRow(row, ['pdvcalle', 'calle']);
      const pdvNumber = this.getValueFromNormalizedRow(row, ['pdvnumero', 'numero', 'nro']);
      const pdvFloor = this.getValueFromNormalizedRow(row, ['pdvpiso', 'piso']);
      const pdvCity = this.getValueFromNormalizedRow(row, ['pdvciudad', 'ciudad', 'localidad']);
      const pdvProvince = this.getValueFromNormalizedRow(row, ['pdvprovincia', 'provincia']);
      const pdvCountry = this.getValueFromNormalizedRow(row, ['pdvpais', 'pais']);
      const pdvPostalCode = this.getValueFromNormalizedRow(row, [
        'pdvcodigopostal',
        'pdvcodigopostal',
        'codigopostal',
        'cp',
      ]);
      const pdvShopping = this.getValueFromNormalizedRow(row, ['pdvshopping', 'shopping']);
      const pdvProcessor = this.getValueFromNormalizedRow(row, ['pdvprocessor']);
      const pdvMerchantNumber = this.getValueFromNormalizedRow(row, [
        'pdvmerchantnumber',
        'nrodeestablecimiento',
        'numerodeestablecimiento',
        'establecimiento',
      ]);

      const establishmentValues: Array<{ network: CardNetwork; value: string }> = [
        {
          network: CardNetwork.VISA,
          value: this.getValueFromNormalizedRow(row, ['estvisa']),
        },
        {
          network: CardNetwork.MASTERCARD,
          value: this.getValueFromNormalizedRow(row, ['estmastercard']),
        },
        {
          network: CardNetwork.AMEX,
          value: this.getValueFromNormalizedRow(row, ['estamex']),
        },
        {
          network: CardNetwork.CABAL,
          value: this.getValueFromNormalizedRow(row, ['estcabal']),
        },
        {
          network: CardNetwork.NARANJA,
          value: this.getValueFromNormalizedRow(row, ['estnaranja']),
        },
        {
          network: CardNetwork.OTRA,
          value: this.getValueFromNormalizedRow(row, ['estotra']),
        },
      ];

      let resolvedBrandId = scopedBrand?.id ?? null;
      if (!resolvedBrandId && brandIdFromRow) {
        const existingById = await this.prisma.brand.findFirst({
          where: { tenantId: params.tenantId, id: brandIdFromRow },
          select: { id: true },
        });
        if (existingById) {
          resolvedBrandId = existingById.id;
        }
      }
      if (!resolvedBrandId && brandName) {
        const cacheKey = brandName.toLowerCase();
        const cached = brandCacheByName.get(cacheKey);
        if (cached) {
          resolvedBrandId = cached;
        } else {
          const existingByName = await this.prisma.brand.findFirst({
            where: { tenantId: params.tenantId, nombre: { equals: brandName, mode: 'insensitive' } },
            select: { id: true },
          });
          if (existingByName) {
            resolvedBrandId = existingByName.id;
            brandCacheByName.set(cacheKey, existingByName.id);
          }
        }
      }
      if (!resolvedBrandId && brandName && !params.merchantId) {
        const createdBrand = await this.prisma.brand.create({
          data: {
            tenantId: params.tenantId,
            nombre: brandName,
            logoUrl: brandLogoUrl || undefined,
            sitioWeb: brandWebsite || undefined,
            emailPrincipal: brandEmail || undefined,
            telefonoPrincipal: brandPhone || undefined,
            processor: params.includeBankSpecificData ? brandProcessor || undefined : undefined,
            activo: true,
          },
          select: { id: true },
        });
        resolvedBrandId = createdBrand.id;
        result.createdBrands += 1;
        brandCacheByName.set(brandName.toLowerCase(), createdBrand.id);
      }
      if (resolvedBrandId) {
        const brandUpdateData: Prisma.BrandUpdateInput = {};
        if (brandName) brandUpdateData.nombre = brandName;
        if (brandLogoUrl) brandUpdateData.logoUrl = brandLogoUrl;
        if (brandWebsite) brandUpdateData.sitioWeb = brandWebsite;
        if (brandEmail) brandUpdateData.emailPrincipal = brandEmail;
        if (brandPhone) brandUpdateData.telefonoPrincipal = brandPhone;
        if (params.includeBankSpecificData && brandProcessor) {
          brandUpdateData.processor = brandProcessor;
        }
        if (Object.keys(brandUpdateData).length > 0) {
          await this.prisma.brand.update({
            where: { id: resolvedBrandId },
            data: brandUpdateData,
          });
          result.updatedBrands += 1;
        }
      }

      let resolvedMerchantId = scopedMerchant?.id ?? '';
      if (!resolvedMerchantId && merchantIdFromRow) {
        const existingById = await this.prisma.merchant.findFirst({
          where: { tenantId: params.tenantId, id: merchantIdFromRow },
          select: { id: true },
        });
        if (existingById) {
          resolvedMerchantId = existingById.id;
        }
      }
      if (!resolvedMerchantId) {
        const lookupKey =
          merchantCuit !== ''
            ? `cuit:${merchantCuit}`
            : `razon:${(merchantRazonSocial || merchantName).toLowerCase()}`;
        const cached = merchantCacheByKey.get(lookupKey);
        if (cached) {
          resolvedMerchantId = cached;
        } else {
          const existingMerchant = merchantCuit
            ? await this.prisma.merchant.findFirst({
                where: { tenantId: params.tenantId, cuit: merchantCuit },
                select: { id: true },
              })
            : merchantRazonSocial || merchantName
              ? await this.prisma.merchant.findFirst({
                  where: {
                    tenantId: params.tenantId,
                    OR: [
                      { razonSocial: { equals: merchantRazonSocial || merchantName, mode: 'insensitive' } },
                      { nombre: { equals: merchantName || merchantRazonSocial, mode: 'insensitive' } },
                    ],
                  },
                  select: { id: true },
                })
              : null;
          if (existingMerchant) {
            resolvedMerchantId = existingMerchant.id;
            merchantCacheByKey.set(lookupKey, existingMerchant.id);
          }
        }
      }

      if (!resolvedMerchantId) {
        const createdMerchant = await this.prisma.merchant.create({
          data: {
            tenantId: params.tenantId,
            nombre: merchantName || merchantRazonSocial || 'Razon social',
            razonSocial: merchantRazonSocial || undefined,
            categoria: merchantCategoria || 'Sin categoria',
            estado: MerchantStatus.PENDING,
            cuit: merchantCuit || undefined,
            direccionSocial: merchantAddress || undefined,
            contactoEmail: merchantEmail || undefined,
            telefono: merchantPhone || undefined,
            merchantNumber: params.includeBankSpecificData ? merchantNumber || undefined : undefined,
            processor: params.includeBankSpecificData ? merchantProcessor || undefined : undefined,
          },
          select: { id: true },
        });
        resolvedMerchantId = createdMerchant.id;
        result.createdMerchants += 1;
      } else {
        const merchantUpdateData: Prisma.MerchantUpdateInput = {};
        if (merchantName) merchantUpdateData.nombre = merchantName;
        if (merchantRazonSocial) merchantUpdateData.razonSocial = merchantRazonSocial;
        if (merchantCategoria) merchantUpdateData.categoria = merchantCategoria;
        if (merchantCuit) merchantUpdateData.cuit = merchantCuit;
        if (merchantAddress) merchantUpdateData.direccionSocial = merchantAddress;
        if (merchantEmail) merchantUpdateData.contactoEmail = merchantEmail;
        if (merchantPhone) merchantUpdateData.telefono = merchantPhone;
        if (params.includeBankSpecificData) {
          if (merchantNumber) merchantUpdateData.merchantNumber = merchantNumber;
          if (merchantProcessor) merchantUpdateData.processor = merchantProcessor;
        }
        if (Object.keys(merchantUpdateData).length > 0) {
          await this.prisma.merchant.update({
            where: { id: resolvedMerchantId },
            data: merchantUpdateData,
          });
          result.updatedMerchants += 1;
        }
      }

      if (resolvedBrandId) {
        const linkKey = `${resolvedBrandId}:${resolvedMerchantId}`;
        if (!linkedPairs.has(linkKey)) {
          const existingLink = await this.prisma.brandLegalEntity.findFirst({
            where: {
              tenantId: params.tenantId,
              brandId: resolvedBrandId,
              merchantId: resolvedMerchantId,
            },
            select: { id: true },
          });
          if (!existingLink) {
            await this.prisma.brandLegalEntity.create({
              data: {
                tenantId: params.tenantId,
                brandId: resolvedBrandId,
                merchantId: resolvedMerchantId,
              },
            });
            result.createdBrandLinks += 1;
          }
          linkedPairs.add(linkKey);
        }
      }

      const hasBranchData = Boolean(
        pdvIdFromRow ||
          pdvName ||
          pdvAddress ||
          pdvStreet ||
          pdvNumber ||
          pdvFloor ||
          pdvCity ||
          pdvProvince ||
          pdvPostalCode ||
          pdvShopping ||
          establishmentValues.some((item) => item.value !== ''),
      );
      if (!hasBranchData) {
        continue;
      }

      let shoppingId: string | undefined;
      if (pdvShopping) {
        const shoppingCacheKey = pdvShopping.toLowerCase();
        const cachedShoppingId = shoppingCache.get(shoppingCacheKey);
        if (cachedShoppingId) {
          shoppingId = cachedShoppingId;
        } else {
          const existingShopping = await this.prisma.shopping.findFirst({
            where: { tenantId: params.tenantId, nombre: { equals: pdvShopping, mode: 'insensitive' } },
            select: { id: true },
          });
          if (existingShopping) {
            shoppingId = existingShopping.id;
          } else {
            const createdShopping = await this.prisma.shopping.create({
              data: { tenantId: params.tenantId, nombre: pdvShopping, activo: true },
              select: { id: true },
            });
            shoppingId = createdShopping.id;
          }
          shoppingCache.set(shoppingCacheKey, shoppingId);
        }
      }

      let branch = pdvIdFromRow
        ? await this.prisma.branch.findFirst({
            where: {
              tenantId: params.tenantId,
              id: pdvIdFromRow,
              merchantId: resolvedMerchantId,
            },
            select: { id: true, retailerId: true },
          })
        : null;

      if (!branch && (pdvName || pdvAddress)) {
        branch = await this.prisma.branch.findFirst({
          where: {
            tenantId: params.tenantId,
            merchantId: resolvedMerchantId,
            ...(pdvName ? { nombre: { equals: pdvName, mode: 'insensitive' } } : {}),
            ...(pdvAddress ? { direccion: { equals: pdvAddress, mode: 'insensitive' } } : {}),
          },
          select: { id: true, retailerId: true },
        });
      }

      const retailerIdForBranch = await this.resolveRetailerIdForBranch({
        tenantId: params.tenantId,
        merchantId: resolvedMerchantId,
        explicitRetailerId: resolvedBrandId,
        fallbackRetailerId: branch?.retailerId ?? null,
        contextLabel: pdvName || pdvIdFromRow || 'el PDV',
        singleRetailerCache: merchantRetailerCache,
      });

      if (!branch) {
        const createdBranch = await this.prisma.branch.create({
          data: {
            tenantId: params.tenantId,
            merchantId: resolvedMerchantId,
            retailerId: retailerIdForBranch,
            nombre: pdvName || `${merchantName || merchantRazonSocial || 'PDV'} - ${pdvCity || 'Local'}`,
            direccion: pdvAddress || 'Sin direccion',
            calle: pdvStreet || undefined,
            numero: pdvNumber || undefined,
            piso: pdvFloor || undefined,
            codigoPostal: pdvPostalCode || undefined,
            ciudad: pdvCity || 'Sin ciudad',
            provincia: pdvProvince || 'Sin provincia',
            pais: pdvCountry || 'Argentina',
            shoppingId,
            merchantNumber: params.includeBankSpecificData ? pdvMerchantNumber || undefined : undefined,
            processor: params.includeBankSpecificData ? pdvProcessor || undefined : undefined,
          },
          select: { id: true, retailerId: true },
        });
        branch = createdBranch;
        result.createdBranches += 1;
      } else {
        const branchUpdateData: Prisma.BranchUncheckedUpdateInput = {};
        if (branch.retailerId !== retailerIdForBranch) {
          branchUpdateData.retailerId = retailerIdForBranch;
        }
        if (pdvName) branchUpdateData.nombre = pdvName;
        if (pdvAddress) branchUpdateData.direccion = pdvAddress;
        if (pdvStreet) branchUpdateData.calle = pdvStreet;
        if (pdvNumber) branchUpdateData.numero = pdvNumber;
        if (pdvFloor) branchUpdateData.piso = pdvFloor;
        if (pdvPostalCode) branchUpdateData.codigoPostal = pdvPostalCode;
        if (pdvCity) branchUpdateData.ciudad = pdvCity;
        if (pdvProvince) branchUpdateData.provincia = pdvProvince;
        if (pdvCountry) branchUpdateData.pais = pdvCountry;
        if (shoppingId) branchUpdateData.shoppingId = shoppingId;
        if (params.includeBankSpecificData) {
          if (pdvMerchantNumber) branchUpdateData.merchantNumber = pdvMerchantNumber;
          if (pdvProcessor) branchUpdateData.processor = pdvProcessor;
        }
        if (Object.keys(branchUpdateData).length > 0) {
          await this.prisma.branch.update({
            where: { id: branch.id },
            data: branchUpdateData,
          });
          result.updatedBranches += 1;
        }
      }

      if (params.includeBankSpecificData) {
        for (const establishment of establishmentValues) {
          if (!establishment.value) {
            continue;
          }
          await this.prisma.branchEstablishment.upsert({
            where: {
              branchId_cardNetwork: {
                branchId: branch.id,
                cardNetwork: establishment.network,
              },
            },
            update: { number: establishment.value },
            create: {
              tenantId: params.tenantId,
              branchId: branch.id,
              cardNetwork: establishment.network,
              number: establishment.value,
            },
          });
          result.updatedEstablishments += 1;
        }
      }
    }

    await this.audit.log({
      tenantId: params.tenantId,
      userId: params.actorId ?? null,
      action: AuditAction.UPDATE,
      entity: 'MerchantPortableImport',
      entityId: params.brandId ?? params.merchantId ?? 'tenant',
      after: result,
    });

    return result;
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
