import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('registro')
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: { tenantId: string; role: Role },
  ) {
    return this.authService.register(dto, user.tenantId, user.role);
  }
}
