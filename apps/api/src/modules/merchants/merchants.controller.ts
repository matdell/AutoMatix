import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role, MerchantStatus } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Get()
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
  )
  async list(
    @CurrentUser() user: { tenantId: string; role: Role; merchantId?: string | null; brandId?: string | null },
    @Query('estado') estado?: MerchantStatus,
    @Query('categoria') categoria?: string,
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      return this.merchantsService.listByBrand(resolvedTenantId, user.brandId, { estado, categoria });
    }
    if (
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId
    ) {
      return [await this.merchantsService.get(resolvedTenantId, user.merchantId)];
    }
    return this.merchantsService.list(resolvedTenantId, { estado, categoria });
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN, Role.BANK_OPS, Role.BRAND_ADMIN)
  async create(
    @Body() dto: CreateMerchantDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      dto.brandIds = [user.brandId];
    }
    return this.merchantsService.create(resolvedTenantId, dto, user.userId);
  }

  @Get('export/csv')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  async exportCsv(@CurrentUser() user: { tenantId: string }) {
    return this.merchantsService.exportCsv(user.tenantId);
  }

  @Get(':id')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
  )
  async get(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; merchantId?: string | null; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.merchantsService.isMerchantInBrand(resolvedTenantId, user.brandId, id);
      if (!allowed) {
        throw new ForbiddenException('No autorizado para acceder a esta razon social');
      }
    }
    if (
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId &&
      user.merchantId !== id
    ) {
      return this.merchantsService.get(resolvedTenantId, user.merchantId);
    }
    return this.merchantsService.get(resolvedTenantId, id);
  }

  @Put(':id')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMerchantDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; merchantId?: string | null; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId &&
      user.merchantId !== id
    ) {
      throw new ForbiddenException('No autorizado para editar otra razon social');
    }
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.merchantsService.isMerchantInBrand(resolvedTenantId, user.brandId, id);
      if (!allowed) {
        throw new ForbiddenException('No autorizado para editar otra razon social');
      }
      if (dto.brandIds && !dto.brandIds.includes(user.brandId)) {
        dto.brandIds = [user.brandId];
      }
    }
    return this.merchantsService.update(resolvedTenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN, Role.BRAND_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.merchantsService.isMerchantInBrand(resolvedTenantId, user.brandId, id);
      if (!allowed) {
        throw new ForbiddenException('No autorizado para eliminar otra razon social');
      }
    }
    return this.merchantsService.remove(resolvedTenantId, id, user.userId);
  }

  @Post('import')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN, Role.BANK_OPS)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.merchantsService.importCsv(resolvedTenantId, file.buffer, user.userId);
  }
}
