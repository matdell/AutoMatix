import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrandsController {
  constructor(private brandsService: BrandsService) {}

  @Get()
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN, Role.BRAND_ADMIN)
  async list(
    @CurrentUser() user: { tenantId: string; role: Role; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    const brands = await this.brandsService.list(resolvedTenantId);
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      return brands.filter((brand) => brand.id === user.brandId);
    }
    return brands;
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async create(
    @Body() dto: CreateBrandDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.brandsService.create(resolvedTenantId, dto, user.userId);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.BRAND_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId && user.brandId !== id) {
      throw new ForbiddenException('No autorizado para editar otra marca');
    }
    return this.brandsService.update(resolvedTenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.brandsService.remove(resolvedTenantId, id, user.userId);
  }

  @Post(':id/legal-entities')
  @Roles(Role.SUPERADMIN, Role.BRAND_ADMIN)
  async linkLegalEntity(
    @Param('id') brandId: string,
    @Body() body: { merchantId: string },
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId && user.brandId !== brandId) {
      throw new ForbiddenException('No autorizado para editar otra marca');
    }
    return this.brandsService.linkLegalEntity(resolvedTenantId, brandId, body.merchantId, user.userId);
  }

  @Delete(':id/legal-entities/:merchantId')
  @Roles(Role.SUPERADMIN, Role.BRAND_ADMIN)
  async unlinkLegalEntity(
    @Param('id') brandId: string,
    @Param('merchantId') merchantId: string,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; brandId?: string | null },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    if (user.role === Role.BRAND_ADMIN && user.brandId && user.brandId !== brandId) {
      throw new ForbiddenException('No autorizado para editar otra marca');
    }
    return this.brandsService.unlinkLegalEntity(resolvedTenantId, brandId, merchantId, user.userId);
  }
}
