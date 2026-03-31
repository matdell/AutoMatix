import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import bcrypt from 'bcryptjs';
import { JwtPayload } from '../common/auth.types';
import { Prisma, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';

authenticator.options = { window: 1 };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notifications: NotificationsService,
  ) {}

  private buildJwtPayload(user: {
    id: string;
    tenantId: string;
    role: Role;
    email: string;
    merchantId?: string | null;
    bankBranchId?: string | null;
  }): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      merchantId: user.merchantId ?? undefined,
      bankBranchId: user.bankBranchId ?? undefined,
    };
  }

  private async issueLogin(user: {
    id: string;
    tenantId: string;
    role: Role;
    email: string;
    nombre: string;
    merchantId?: string | null;
    bankBranchId?: string | null;
  }) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = this.buildJwtPayload(user);

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        bankBranchId: user.bankBranchId ?? null,
      },
    };
  }

  private buildTwoFactorMethods(user: { twoFactorEmailEnabled: boolean; twoFactorTotpEnabled: boolean }) {
    const methods: Array<'email' | 'totp'> = [];
    if (user.twoFactorTotpEnabled) methods.push('totp');
    if (user.twoFactorEmailEnabled) methods.push('email');
    return methods;
  }

  private generateEmailCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async createTwoFactorSession(user: {
    id: string;
    tenantId: string;
    email: string;
    twoFactorEmailEnabled: boolean;
  }) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10);
    let emailCode: string | null = null;
    let emailCodeExpiresAt: Date | null = null;

    if (user.twoFactorEmailEnabled) {
      emailCode = this.generateEmailCode();
      emailCodeExpiresAt = expiresAt;
    }

    const session = await this.prisma.twoFactorSession.create({
      data: {
        userId: user.id,
        expiresAt,
        emailCode,
        emailCodeExpiresAt,
      },
    });

    if (emailCode) {
      await this.notifications.sendTwoFactorCode(user.tenantId, user.email, emailCode);
    }

    return { session, emailSent: Boolean(emailCode) };
  }

  async login(dto: LoginDto) {
    let bank = dto.bankSlug
      ? await this.prisma.bank.findUnique({ where: { slug: dto.bankSlug } })
      : null;

    if (!bank) {
      const candidates = await this.prisma.user.findMany({
        where: { email: dto.email, isActive: true },
        select: { tenantId: true },
        take: 2,
      });
      if (candidates.length === 1) {
        bank = await this.prisma.bank.findUnique({ where: { id: candidates[0].tenantId } });
      }
    }

    if (!bank) {
      throw new UnauthorizedException('Banco no encontrado. Indique el banco.');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: bank.id,
        email: dto.email,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const methods = this.buildTwoFactorMethods(user);
    if (methods.length > 0) {
      const { session, emailSent } = await this.createTwoFactorSession({
        id: user.id,
        tenantId: bank.id,
        email: user.email,
        twoFactorEmailEnabled: user.twoFactorEmailEnabled,
      });
      return {
        requiresTwoFactor: true,
        twoFactorToken: session.id,
        methods,
        emailSent,
      };
    }

    return this.issueLogin({
      id: user.id,
      tenantId: bank.id,
      role: user.role,
      email: user.email,
      nombre: user.nombre,
      merchantId: user.merchantId,
      bankBranchId: user.bankBranchId,
    });
  }

  async register(dto: RegisterDto, tenantId: string, actorRole: Role) {
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('No autorizado para crear SuperAdmin');
    }
    if (dto.tenantId && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('No autorizado para definir banco');
    }
    const branchRoles: Role[] = [Role.BANK_BRANCH_MANAGER, Role.BANK_BRANCH_OPERATOR];
    if (branchRoles.includes(dto.role) && !dto.bankBranchId) {
      throw new BadRequestException('La sucursal bancaria es obligatoria para este rol');
    }
    if (dto.bankBranchId && !branchRoles.includes(dto.role)) {
      throw new BadRequestException('La sucursal bancaria solo aplica a roles de sucursal');
    }
    const targetTenantId =
      dto.role === Role.SUPERADMIN
        ? tenantId
        : actorRole === Role.SUPERADMIN && dto.tenantId
          ? dto.tenantId
          : tenantId;

    if (actorRole === Role.SUPERADMIN && dto.tenantId && dto.tenantId !== tenantId) {
      const bank = await this.prisma.bank.findUnique({ where: { id: dto.tenantId } });
      if (!bank) {
        throw new BadRequestException('Banco no encontrado');
      }
    }
    if (dto.bankBranchId) {
      const branch = await this.prisma.bankBranch.findUnique({ where: { id: dto.bankBranchId } });
      if (!branch || branch.bankId !== targetTenantId) {
        throw new BadRequestException('Sucursal bancaria invalida');
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId: targetTenantId,
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        role: dto.role,
        merchantId: dto.merchantId ?? null,
        bankBranchId: dto.bankBranchId ?? null,
      },
    });

    const bank = await this.prisma.bank.findUnique({
      where: { id: targetTenantId },
      select: { slug: true },
    });
    await this.notifications.sendWelcome(
      targetTenantId,
      user.email,
      user.nombre,
      dto.password,
      bank?.slug ?? undefined,
    );

    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
    };
  }

  async me(userId: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        tenantId: true,
        merchantId: true,
        bankBranchId: true,
        lastLoginAt: true,
        twoFactorEmailEnabled: true,
        twoFactorTotpEnabled: true,
      },
    });
  }

  async updateProfile(userId: string, tenantId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          nombre: dto.nombre?.trim() || undefined,
          email: dto.email ? dto.email.toLowerCase() : undefined,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          role: true,
          tenantId: true,
          merchantId: true,
          bankBranchId: true,
          lastLoginAt: true,
        },
      });
      return updated;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('El email ya esta en uso');
      }
      throw err;
    }
  }

  async changePassword(userId: string, tenantId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('La contrasena actual es incorrecta');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    let bank = dto.bankSlug
      ? await this.prisma.bank.findUnique({ where: { slug: dto.bankSlug } })
      : null;

    if (!bank) {
      const candidates = await this.prisma.user.findMany({
        where: { email, isActive: true },
        select: { tenantId: true },
        take: 2,
      });
      if (candidates.length === 1) {
        bank = await this.prisma.bank.findUnique({ where: { id: candidates[0].tenantId } });
      }
    }

    if (!bank) {
      return { ok: true };
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId: bank.id, email, isActive: true },
      select: { id: true, email: true },
    });
    if (!user) {
      return { ok: true };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    await this.notifications.sendPasswordReset(bank.id, user.email, token);

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Token invalido o expirado');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { ok: true };
  }

  async updateTwoFactorEmail(userId: string, tenantId: string, enabled: boolean) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEmailEnabled: enabled },
      select: {
        id: true,
        twoFactorEmailEnabled: true,
        twoFactorTotpEnabled: true,
      },
    });
    return updated;
  }

  async setupTotp(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const secret = authenticator.generateSecret();
    const issuer = 'AutoMatix';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorTotpSecret: secret,
        twoFactorTotpEnabled: false,
      },
    });

    return { secret, otpauthUrl };
  }

  async verifyTotp(userId: string, tenantId: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { twoFactorTotpSecret: true },
    });
    if (!user || !user.twoFactorTotpSecret) {
      throw new BadRequestException('No hay configuracion de Google Authenticator');
    }
    const token = code.replace(/\s/g, '');
    const isValid = authenticator.verify({ token, secret: user.twoFactorTotpSecret });
    if (!isValid) {
      throw new BadRequestException('Codigo invalido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorTotpEnabled: true },
    });

    return { ok: true };
  }

  async disableTotp(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorTotpEnabled: false, twoFactorTotpSecret: null },
    });

    return { ok: true };
  }

  async verifyTwoFactor(token: string, code: string, method: 'email' | 'totp') {
    const session = await this.prisma.twoFactorSession.findUnique({
      where: { id: token },
      include: { user: true },
    });
    if (!session || session.usedAt || session.expiresAt < new Date()) {
      throw new BadRequestException('La sesion de verificacion expiro');
    }

    const user = session.user;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const cleanCode = code.replace(/\s/g, '');

    if (method === 'email') {
      if (!user.twoFactorEmailEnabled) {
        throw new BadRequestException('La verificacion por email no esta habilitada');
      }
      if (!session.emailCode || !session.emailCodeExpiresAt || session.emailCodeExpiresAt < new Date()) {
        throw new BadRequestException('El codigo expiro');
      }
      if (session.emailCodeUsedAt) {
        throw new BadRequestException('El codigo ya fue utilizado');
      }
      if (session.emailCode !== cleanCode) {
        throw new BadRequestException('Codigo invalido');
      }
    }

    if (method === 'totp') {
      if (!user.twoFactorTotpEnabled || !user.twoFactorTotpSecret) {
        throw new BadRequestException('Google Authenticator no esta habilitado');
      }
      const isValid = authenticator.verify({ token: cleanCode, secret: user.twoFactorTotpSecret });
      if (!isValid) {
        throw new BadRequestException('Codigo invalido');
      }
    }

    await this.prisma.twoFactorSession.update({
      where: { id: session.id },
      data: {
        usedAt: new Date(),
        emailCodeUsedAt: method === 'email' ? new Date() : session.emailCodeUsedAt,
      },
    });

    return this.issueLogin({
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      nombre: user.nombre,
      merchantId: user.merchantId,
      bankBranchId: user.bankBranchId,
    });
  }

  async resendTwoFactorCode(token: string) {
    const session = await this.prisma.twoFactorSession.findUnique({
      where: { id: token },
      include: { user: true },
    });
    if (!session || session.usedAt || session.expiresAt < new Date()) {
      throw new BadRequestException('La sesion de verificacion expiro');
    }

    const user = session.user;
    if (!user || !user.twoFactorEmailEnabled) {
      throw new BadRequestException('La verificacion por email no esta habilitada');
    }

    const emailCode = this.generateEmailCode();
    const emailCodeExpiresAt = new Date(Date.now() + 1000 * 60 * 10);

    await this.prisma.twoFactorSession.update({
      where: { id: session.id },
      data: {
        emailCode,
        emailCodeExpiresAt,
        emailCodeUsedAt: null,
      },
    });

    await this.notifications.sendTwoFactorCode(user.tenantId, user.email, emailCode);

    return { ok: true };
  }
}
