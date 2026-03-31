import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS, Role.BANK_BRANCH_MANAGER)
  @Get()
  async list(@CurrentUser() user: { tenantId: string }) {
    return this.invitationsService.list(user.tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS, Role.BANK_BRANCH_MANAGER)
  @Post()
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.invitationsService.create(user.tenantId, dto, user.userId);
  }

  @Post(':token/accept')
  async accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(token, dto);
  }

  @Post(':token/reject')
  async reject(@Param('token') token: string) {
    return this.invitationsService.reject(token);
  }
}
