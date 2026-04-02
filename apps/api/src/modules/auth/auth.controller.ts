import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorResendDto } from './dto/two-factor-resend.dto';
import { TwoFactorEmailDto } from './dto/two-factor-email.dto';
import { TwoFactorTotpVerifyDto } from './dto/two-factor-totp-verify.dto';
import { TwoFactorTotpDisableDto } from './dto/two-factor-totp-disable.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { Request } from 'express';
import { RateLimitService } from '../common/rate-limit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimit: RateLimitService,
  ) {}

  private applyRateLimit(
    request: Request,
    params: {
      ipKey: string;
      accountKey?: string;
      limitEnv?: string;
      windowEnv?: string;
      defaultLimit?: number;
      defaultWindowMs?: number;
      message?: string;
    },
  ) {
    const ip = this.rateLimit.resolveClientIp(request);
    const limit = this.rateLimit.getLimit(params.limitEnv || 'RATE_LIMIT_AUTH_LIMIT', params.defaultLimit ?? 10);
    const windowMs = this.rateLimit.getWindowMs(
      params.windowEnv || 'RATE_LIMIT_AUTH_WINDOW_MS',
      params.defaultWindowMs ?? 10 * 60 * 1000,
    );

    this.rateLimit.consumeOrThrow({
      key: `${params.ipKey}:${ip}`,
      limit,
      windowMs,
      message: params.message,
    });
    if (params.accountKey) {
      this.rateLimit.consumeOrThrow({
        key: params.accountKey,
        limit,
        windowMs,
        message: params.message,
      });
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    this.applyRateLimit(request, {
      ipKey: 'auth:login:ip',
      accountKey: dto.email ? `auth:login:account:${dto.email.toLowerCase()}` : undefined,
      limitEnv: 'RATE_LIMIT_LOGIN_LIMIT',
      windowEnv: 'RATE_LIMIT_LOGIN_WINDOW_MS',
      defaultLimit: 8,
      defaultWindowMs: 10 * 60 * 1000,
      message: 'Demasiados intentos de login. Reintenta mas tarde.',
    });
    const forwardedHost = request.headers['x-forwarded-host'];
    const host =
      typeof forwardedHost === 'string'
        ? forwardedHost
        : Array.isArray(forwardedHost)
          ? forwardedHost[0]
          : request.headers.host;
    return this.authService.login(dto, host);
  }

  @Post('2fa/verify')
  async verifyTwoFactor(@Body() dto: TwoFactorVerifyDto, @Req() request: Request) {
    this.applyRateLimit(request, {
      ipKey: 'auth:2fa:verify:ip',
      accountKey: dto.token ? `auth:2fa:verify:token:${dto.token}` : undefined,
      limitEnv: 'RATE_LIMIT_2FA_VERIFY_LIMIT',
      windowEnv: 'RATE_LIMIT_2FA_VERIFY_WINDOW_MS',
      defaultLimit: 6,
      defaultWindowMs: 10 * 60 * 1000,
      message: 'Demasiados intentos de verificacion 2FA. Reintenta mas tarde.',
    });
    return this.authService.verifyTwoFactor(dto.token, dto.code, dto.method);
  }

  @Post('2fa/resend')
  async resendTwoFactor(@Body() dto: TwoFactorResendDto, @Req() request: Request) {
    this.applyRateLimit(request, {
      ipKey: 'auth:2fa:resend:ip',
      accountKey: dto.token ? `auth:2fa:resend:token:${dto.token}` : undefined,
      limitEnv: 'RATE_LIMIT_2FA_RESEND_LIMIT',
      windowEnv: 'RATE_LIMIT_2FA_RESEND_WINDOW_MS',
      defaultLimit: 5,
      defaultWindowMs: 10 * 60 * 1000,
      message: 'Demasiados reenvios de codigo 2FA. Reintenta mas tarde.',
    });
    return this.authService.resendTwoFactorCode(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { userId: string; tenantId: string }) {
    return this.authService.me(user.userId, user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { userId: string; tenantId: string },
  ) {
    return this.authService.updateProfile(user.userId, user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('2fa/email')
  async updateTwoFactorEmail(
    @Body() dto: TwoFactorEmailDto,
    @CurrentUser() user: { userId: string; tenantId: string },
  ) {
    return this.authService.updateTwoFactorEmail(
      user.userId,
      user.tenantId,
      dto.enabled,
      dto.currentPassword,
      dto.totpCode,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/totp/setup')
  async setupTotp(@CurrentUser() user: { userId: string; tenantId: string }) {
    return this.authService.setupTotp(user.userId, user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/totp/verify')
  async verifyTotp(
    @Body() dto: TwoFactorTotpVerifyDto,
    @CurrentUser() user: { userId: string; tenantId: string },
  ) {
    return this.authService.verifyTotp(user.userId, user.tenantId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/totp/disable')
  async disableTotp(
    @Body() dto: TwoFactorTotpDisableDto,
    @CurrentUser() user: { userId: string; tenantId: string },
  ) {
    return this.authService.disableTotp(user.userId, user.tenantId, dto.currentPassword, dto.totpCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { userId: string; tenantId: string },
  ) {
    return this.authService.changePassword(user.userId, user.tenantId, dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    this.applyRateLimit(request, {
      ipKey: 'auth:forgot-password:ip',
      accountKey: dto.email ? `auth:forgot-password:account:${dto.email.toLowerCase()}` : undefined,
      limitEnv: 'RATE_LIMIT_FORGOT_PASSWORD_LIMIT',
      windowEnv: 'RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS',
      defaultLimit: 5,
      defaultWindowMs: 10 * 60 * 1000,
      message: 'Demasiadas solicitudes de recuperacion. Reintenta mas tarde.',
    });
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.SUPERADMIN,
    Role.BANK_ADMIN,
    Role.BANK_BRANCH_MANAGER,
    Role.BRAND_ADMIN,
    Role.LEGAL_ENTITY_ADMIN,
    Role.MERCHANT_ADMIN,
    Role.MERCHANT_USER,
  )
  @Post('registro')
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: {
      tenantId: string;
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
  ) {
    return this.authService.register(dto, user);
  }
}
