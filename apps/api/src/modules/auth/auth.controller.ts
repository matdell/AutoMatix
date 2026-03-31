import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
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
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('2fa/verify')
  async verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return this.authService.verifyTwoFactor(dto.token, dto.code, dto.method);
  }

  @Post('2fa/resend')
  async resendTwoFactor(@Body() dto: TwoFactorResendDto) {
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
    return this.authService.updateTwoFactorEmail(user.userId, user.tenantId, dto.enabled);
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
  async disableTotp(@CurrentUser() user: { userId: string; tenantId: string }) {
    return this.authService.disableTotp(user.userId, user.tenantId);
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
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
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
