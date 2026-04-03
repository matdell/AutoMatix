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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ensureCsvFile, FILE_INTERCEPTOR_OPTIONS } from '../common/upload-security';
import { isCentralPlatformMode } from '../common/platform-mode';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  private resolveTenantId(user: { tenantId: string; role: Role }, bankId?: string) {
    if (isCentralPlatformMode() && user.role === Role.SUPERADMIN) {
      return user.tenantId;
    }
    return user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
  }

  @Get()
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BANK_APPROVER,
    Role.BANK_BRANCH_MANAGER,
    Role.BANK_BRANCH_OPERATOR,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
    Role.POS_ADMIN,
  )
  async list(
    @CurrentUser() user: {
      tenantId: string;
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.usersService.list(resolvedTenantId, {
      role: user.role,
      bankBranchId: user.bankBranchId,
      brandId: user.brandId,
      merchantId: user.merchantId,
      pointOfSaleId: user.pointOfSaleId,
    });
  }

  @Get(':id')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BANK_APPROVER,
    Role.BANK_BRANCH_MANAGER,
    Role.BANK_BRANCH_OPERATOR,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
    Role.POS_ADMIN,
  )
  async get(
    @Param('id') id: string,
    @CurrentUser() user: {
      tenantId: string;
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.usersService.get(resolvedTenantId, id, {
      role: user.role,
      bankBranchId: user.bankBranchId,
      brandId: user.brandId,
      merchantId: user.merchantId,
      pointOfSaleId: user.pointOfSaleId,
    });
  }

  @Patch(':id')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_BRANCH_MANAGER,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.POS_ADMIN,
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: {
      tenantId: string;
      userId: string;
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.usersService.update(
      resolvedTenantId,
      id,
      dto,
      {
        role: user.role,
        bankBranchId: user.bankBranchId,
        brandId: user.brandId,
        merchantId: user.merchantId,
        pointOfSaleId: user.pointOfSaleId,
      },
      user.userId,
      user.role,
    );
  }

  @Delete(':id')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_BRANCH_MANAGER,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.POS_ADMIN,
  )
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: {
      tenantId: string;
      userId: string;
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.usersService.deactivate(
      resolvedTenantId,
      id,
      {
        role: user.role,
        bankBranchId: user.bankBranchId,
        brandId: user.brandId,
        merchantId: user.merchantId,
        pointOfSaleId: user.pointOfSaleId,
      },
      user.userId,
    );
  }

  @Post('import')
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_BRANCH_MANAGER,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
  )
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    ensureCsvFile(file);
    if (isCentralPlatformMode() && user.role === Role.SUPERADMIN) {
      throw new ForbiddenException('Importacion masiva no disponible en plataforma central');
    }
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.usersService.importCsv(resolvedTenantId, file.buffer, user.userId);
  }
}
