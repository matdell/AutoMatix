import {
  Body,
  Controller,
  Delete,
  Get,
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
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS, Role.MERCHANT_ADMIN, Role.MERCHANT_USER)
  async list(
    @Param('merchantId') merchantId: string,
    @CurrentUser() user: { tenantId: string; role: Role; merchantId?: string },
  ) {
    const resolvedMerchant =
      (user.role === Role.MERCHANT_ADMIN || user.role === Role.MERCHANT_USER || user.role === Role.MERCHANT) && user.merchantId ? user.merchantId : merchantId;
    return this.branchesService.listByMerchant(user.tenantId, resolvedMerchant);
  }

  @Post('merchants/:merchantId/branches')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  async create(
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.branchesService.create(user.tenantId, merchantId, dto, user.userId);
  }

  @Put('branches/:id')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.branchesService.update(user.tenantId, id, dto, user.userId);
  }

  @Delete('branches/:id')
  @Roles(Role.BANK_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.branchesService.remove(user.tenantId, id, user.userId);
  }
}
