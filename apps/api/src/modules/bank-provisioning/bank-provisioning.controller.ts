import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BankProvisioningService } from './bank-provisioning.service';
import { CreateBankProvisioningRequestDto } from './dto/create-bank-provisioning-request.dto';
import { UpdateBankProvisioningStatusDto } from './dto/update-bank-provisioning-status.dto';

@Controller('banks/:bankId/provisioning-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class BankProvisioningController {
  constructor(private provisioning: BankProvisioningService) {}

  @Get()
  async list(@Param('bankId') bankId: string) {
    return this.provisioning.list(bankId);
  }

  @Post()
  async create(
    @Param('bankId') bankId: string,
    @Body() dto: CreateBankProvisioningRequestDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.provisioning.create(bankId, dto, user.userId);
  }

  @Patch(':requestId/status')
  async updateStatus(
    @Param('bankId') bankId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateBankProvisioningStatusDto,
  ) {
    return this.provisioning.updateStatus(bankId, requestId, dto);
  }

  @Post(':requestId/run')
  async runNow(
    @Param('bankId') bankId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.provisioning.runNow(bankId, requestId);
  }
}
