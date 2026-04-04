import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesService } from './categories.service';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BANK_APPROVER,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
  )
  async list(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.categoriesService.list(resolvedTenantId);
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.categoriesService.create(resolvedTenantId, dto, user.userId);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.categoriesService.update(resolvedTenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.categoriesService.remove(resolvedTenantId, id, user.userId);
  }
}
