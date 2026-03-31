import {
  Body,
  Controller,
  Delete,
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

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.BANK_ADMIN,
  Role.BANK_BRANCH_MANAGER,
  Role.BRAND_ADMIN,
  Role.LEGAL_ENTITY_ADMIN,
  Role.MERCHANT_ADMIN,
  Role.MERCHANT_USER,
)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
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
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.list(resolvedTenantId, {
      role: user.role,
      bankBranchId: user.bankBranchId,
      brandId: user.brandId,
      merchantId: user.merchantId,
      pointOfSaleId: user.pointOfSaleId,
    });
  }

  @Get(':id')
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
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.get(resolvedTenantId, id, {
      role: user.role,
      bankBranchId: user.bankBranchId,
      brandId: user.brandId,
      merchantId: user.merchantId,
      pointOfSaleId: user.pointOfSaleId,
    });
  }

  @Patch(':id')
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
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
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
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
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
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.importCsv(resolvedTenantId, file.buffer, user.userId);
  }
}
