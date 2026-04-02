import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RejectInvitationDto } from './dto/reject-invitation.dto';
import { RateLimitService } from '../common/rate-limit.service';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private invitationsService: InvitationsService,
    private rateLimit: RateLimitService,
  ) {}

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
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
  ) {
    const ip = this.rateLimit.resolveClientIp(request);
    const limit = this.rateLimit.getLimit('RATE_LIMIT_INVITATION_ACCEPT_LIMIT', 5);
    const windowMs = this.rateLimit.getWindowMs('RATE_LIMIT_INVITATION_ACCEPT_WINDOW_MS', 10 * 60 * 1000);
    this.rateLimit.consumeOrThrow({
      key: `invite:accept:ip:${ip}`,
      limit,
      windowMs,
      message: 'Demasiados intentos para aceptar invitaciones. Reintenta mas tarde.',
    });
    this.rateLimit.consumeOrThrow({
      key: `invite:accept:token:${token}`,
      limit,
      windowMs,
      message: 'Demasiados intentos para aceptar invitaciones. Reintenta mas tarde.',
    });
    return this.invitationsService.accept(token, dto);
  }

  @Post(':token/reject')
  async reject(
    @Param('token') token: string,
    @Body() dto: RejectInvitationDto,
    @Req() request: Request,
  ) {
    const ip = this.rateLimit.resolveClientIp(request);
    const limit = this.rateLimit.getLimit('RATE_LIMIT_INVITATION_REJECT_LIMIT', 5);
    const windowMs = this.rateLimit.getWindowMs('RATE_LIMIT_INVITATION_REJECT_WINDOW_MS', 10 * 60 * 1000);
    this.rateLimit.consumeOrThrow({
      key: `invite:reject:ip:${ip}`,
      limit,
      windowMs,
      message: 'Demasiados intentos para rechazar invitaciones. Reintenta mas tarde.',
    });
    this.rateLimit.consumeOrThrow({
      key: `invite:reject:token:${token}`,
      limit,
      windowMs,
      message: 'Demasiados intentos para rechazar invitaciones. Reintenta mas tarde.',
    });
    return this.invitationsService.reject(token, dto.email);
  }
}
