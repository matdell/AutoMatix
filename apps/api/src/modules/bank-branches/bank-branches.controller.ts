import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BankBranchesService } from './bank-branches.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateBankBranchDto } from './dto/create-bank-branch.dto';
import { UpdateBankBranchDto } from './dto/update-bank-branch.dto';

@Controller('bank-branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankBranchesController {
  constructor(private bankBranchesService: BankBranchesService) {}

  @Get()
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_OPS,
    Role.BANK_APPROVER,
    Role.BANK_BRANCH_MANAGER,
    Role.BANK_BRANCH_OPERATOR,
  )
  async list(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedBankId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.bankBranchesService.list(resolvedBankId);
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async create(
    @Body() dto: CreateBankBranchDto,
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedBankId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.bankBranchesService.create(resolvedBankId, dto);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBankBranchDto,
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedBankId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.bankBranchesService.update(resolvedBankId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedBankId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.bankBranchesService.remove(resolvedBankId, id);
  }
}
