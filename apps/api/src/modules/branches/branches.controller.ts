import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get('merchants/:merchantId/branches')
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
    @Param('merchantId') merchantId: string,
    @CurrentUser() user: { tenantId: string; role: Role; merchantId?: string | null; brandId?: string | null },
  ) {
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.branchesService.isMerchantInBrand(user.tenantId, user.brandId, merchantId);
      if (!allowed) {
        throw new NotFoundException('Razon social no encontrada');
      }
    }
    const resolvedMerchant =
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId
        ? user.merchantId
        : merchantId;
    return this.branchesService.listByMerchant(user.tenantId, resolvedMerchant);
  }

  @Post('merchants/:merchantId/branches')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
  )
  async create(
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; merchantId?: string | null; brandId?: string | null },
  ) {
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.branchesService.isMerchantInBrand(user.tenantId, user.brandId, merchantId);
      if (!allowed) {
        throw new NotFoundException('Razon social no encontrada');
      }
      if (dto.retailerId && dto.retailerId !== user.brandId) {
        throw new ForbiddenException('No autorizado para crear PDV en otro retailer');
      }
      dto.retailerId = user.brandId;
    }
    const resolvedMerchant =
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId
        ? user.merchantId
        : merchantId;
    return this.branchesService.create(user.tenantId, resolvedMerchant, dto, user.userId);
  }

  @Put('branches/:id')
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
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; merchantId?: string | null; brandId?: string | null },
  ) {
    const branch = await this.branchesService.get(user.tenantId, id);
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.branchesService.isMerchantInBrand(user.tenantId, user.brandId, branch.merchantId);
      if (!allowed) {
        throw new NotFoundException('Punto de venta no encontrado');
      }
      if (branch.retailerId && branch.retailerId !== user.brandId) {
        throw new NotFoundException('Punto de venta no encontrado');
      }
      if (dto.retailerId !== undefined && dto.retailerId !== user.brandId) {
        throw new ForbiddenException('No autorizado para mover PDV a otro retailer');
      }
      if (!branch.retailerId && dto.retailerId === undefined) {
        dto.retailerId = user.brandId;
      }
    }
    if (
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId &&
      user.merchantId !== branch.merchantId
    ) {
      throw new NotFoundException('Punto de venta no encontrado');
    }
    return this.branchesService.update(user.tenantId, id, dto, user.userId);
  }

  @Delete('branches/:id')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN, Role.BRAND_ADMIN, Role.LEGAL_ENTITY_ADMIN, Role.MERCHANT_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role; merchantId?: string | null; brandId?: string | null },
  ) {
    const branch = await this.branchesService.get(user.tenantId, id);
    if (user.role === Role.BRAND_ADMIN && user.brandId) {
      const allowed = await this.branchesService.isMerchantInBrand(user.tenantId, user.brandId, branch.merchantId);
      if (!allowed) {
        throw new NotFoundException('Punto de venta no encontrado');
      }
    }
    if (
      (user.role === Role.LEGAL_ENTITY_ADMIN ||
        user.role === Role.MERCHANT_ADMIN ||
        user.role === Role.MERCHANT_USER ||
        user.role === Role.MERCHANT) &&
      user.merchantId &&
      user.merchantId !== branch.merchantId
    ) {
      throw new NotFoundException('Punto de venta no encontrado');
    }
    return this.branchesService.remove(user.tenantId, id, user.userId);
  }
}
