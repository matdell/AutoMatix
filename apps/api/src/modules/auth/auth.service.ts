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
import { ConfigService } from '@nestjs/config';

authenticator.options = { window: 1 };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  private normalizeHost(rawHost?: string | null) {
    if (!rawHost) {
      return null;
    }
    const first = rawHost.split(',')[0]?.trim().toLowerCase();
    if (!first) {
      return null;
    }
    return first.replace(/:\d+$/, '');
  }

  private async findBankBySlug(slug?: string | null) {
    const normalized = slug?.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return this.prisma.bank.findUnique({ where: { slug: normalized } });
  }

  private async resolveBankForLogin(dto: LoginDto, requestHost?: string) {
    const byRequest = await this.findBankBySlug(dto.bankSlug);
    if (byRequest) {
      return byRequest;
    }

    const envDefaultSlug = this.config.get<string>('LOGIN_DEFAULT_BANK_SLUG');
    const byEnvDefault = await this.findBankBySlug(envDefaultSlug);
    if (byEnvDefault) {
      return byEnvDefault;
    }

    const normalizedHost = this.normalizeHost(requestHost);
    const subdomain = normalizedHost?.split('.')[0];
    const bySubdomain = await this.findBankBySlug(subdomain);
    if (bySubdomain) {
      return bySubdomain;
    }

    const candidates = await this.prisma.user.findMany({
      where: { email: dto.email, isActive: true },
      select: { tenantId: true },
      take: 2,
    });
    if (candidates.length === 1) {
      return this.prisma.bank.findUnique({ where: { id: candidates[0].tenantId } });
    }

    return null;
  }

  private buildJwtPayload(user: {
    id: string;
    tenantId: string;
    role: Role;
    email: string;
    brandId?: string | null;
    merchantId?: string | null;
    bankBranchId?: string | null;
    pointOfSaleId?: string | null;
  }): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      brandId: user.brandId ?? undefined,
      merchantId: user.merchantId ?? undefined,
      bankBranchId: user.bankBranchId ?? undefined,
      pointOfSaleId: user.pointOfSaleId ?? undefined,
    };
  }

  private async issueLogin(user: {
    id: string;
    tenantId: string;
    role: Role;
    email: string;
    nombre: string;
    brandId?: string | null;
    merchantId?: string | null;
    bankBranchId?: string | null;
    pointOfSaleId?: string | null;
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
        brandId: user.brandId ?? null,
        bankBranchId: user.bankBranchId ?? null,
        merchantId: user.merchantId ?? null,
        pointOfSaleId: user.pointOfSaleId ?? null,
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

  async login(dto: LoginDto, requestHost?: string) {
    const bank = await this.resolveBankForLogin(dto, requestHost);
    if (!bank) {
      throw new UnauthorizedException('Banco no encontrado para este dominio.');
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
      brandId: user.brandId,
      merchantId: user.merchantId,
      bankBranchId: user.bankBranchId,
      pointOfSaleId: user.pointOfSaleId,
    });
  }

  async register(
    dto: RegisterDto,
    actor: {
      tenantId: string;
      role: Role;
      bankBranchId?: string | null;
      brandId?: string | null;
      merchantId?: string | null;
      pointOfSaleId?: string | null;
    },
  ) {
    const actorRole = actor.role;
    const tenantId = actor.tenantId;
    if (actorRole === Role.BANK_BRANCH_MANAGER) {
      const allowed = new Set<Role>([Role.BANK_BRANCH_MANAGER, Role.BANK_BRANCH_OPERATOR]);
      if (!allowed.has(dto.role)) {
        throw new ForbiddenException('No autorizado para crear usuarios fuera de la sucursal bancaria');
      }
    }
    if (actorRole === Role.BRAND_ADMIN) {
      const allowed = new Set<Role>([Role.BRAND_ADMIN, Role.LEGAL_ENTITY_ADMIN, Role.POS_ADMIN, Role.MERCHANT_ADMIN, Role.MERCHANT_USER]);
      if (!allowed.has(dto.role)) {
        throw new ForbiddenException('No autorizado para crear usuarios fuera de la marca');
      }
    }
    if (actorRole === Role.LEGAL_ENTITY_ADMIN || actorRole === Role.MERCHANT_ADMIN || actorRole === Role.MERCHANT_USER) {
      const allowed = new Set<Role>([Role.LEGAL_ENTITY_ADMIN, Role.POS_ADMIN, Role.MERCHANT_ADMIN, Role.MERCHANT_USER]);
      if (!allowed.has(dto.role)) {
        throw new ForbiddenException('No autorizado para crear usuarios fuera de la razon social');
      }
    }
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('No autorizado para crear SuperAdmin');
    }
    if (dto.tenantId && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('No autorizado para definir banco');
    }
    const branchRoles = new Set<Role>([Role.BANK_BRANCH_MANAGER, Role.BANK_BRANCH_OPERATOR]);
    const brandRoles = new Set<Role>([Role.BRAND_ADMIN]);
    const legalEntityRoles = new Set<Role>([Role.LEGAL_ENTITY_ADMIN, Role.MERCHANT_ADMIN, Role.MERCHANT_USER]);
    const posRoles = new Set<Role>([Role.POS_ADMIN]);

    if (branchRoles.has(dto.role) && !dto.bankBranchId) {
      throw new BadRequestException('La sucursal bancaria es obligatoria para este rol');
    }
    if (dto.bankBranchId && !branchRoles.has(dto.role)) {
      throw new BadRequestException('La sucursal bancaria solo aplica a roles de sucursal');
    }
    if (brandRoles.has(dto.role) && !dto.brandId) {
      throw new BadRequestException('La marca es obligatoria para este rol');
    }
    if (dto.brandId && !brandRoles.has(dto.role)) {
      throw new BadRequestException('La marca solo aplica a roles de marca');
    }
    if (legalEntityRoles.has(dto.role) && !dto.merchantId) {
      throw new BadRequestException('La razon social es obligatoria para este rol');
    }
    if (dto.merchantId && !legalEntityRoles.has(dto.role) && !posRoles.has(dto.role)) {
      throw new BadRequestException('La razon social solo aplica a roles comerciales');
    }
    if (posRoles.has(dto.role) && !dto.pointOfSaleId) {
      throw new BadRequestException('El punto de venta es obligatorio para este rol');
    }
    if (dto.pointOfSaleId && !posRoles.has(dto.role)) {
      throw new BadRequestException('El punto de venta solo aplica a roles de PDV');
    }
    const targetTenantId =
      dto.role === Role.SUPERADMIN
        ? tenantId
        : actorRole === Role.SUPERADMIN && dto.tenantId
          ? dto.tenantId
          : tenantId;

    if (actorRole === Role.BANK_BRANCH_MANAGER) {
      if (!actor.bankBranchId) {
        throw new ForbiddenException('Sucursal bancaria no configurada para el usuario');
      }
      if (dto.bankBranchId && dto.bankBranchId !== actor.bankBranchId) {
        throw new ForbiddenException('No autorizado para asignar otra sucursal bancaria');
      }
      dto.bankBranchId = actor.bankBranchId;
    }
    if (actorRole === Role.BRAND_ADMIN) {
      if (!actor.brandId) {
        throw new ForbiddenException('Marca no configurada para el usuario');
      }
      if (dto.brandId && dto.brandId !== actor.brandId) {
        throw new ForbiddenException('No autorizado para asignar otra marca');
      }
      dto.brandId = actor.brandId;
    }
    if (actorRole === Role.LEGAL_ENTITY_ADMIN || actorRole === Role.MERCHANT_ADMIN || actorRole === Role.MERCHANT_USER) {
      if (!actor.merchantId) {
        throw new ForbiddenException('Razon social no configurada para el usuario');
      }
      if (dto.merchantId && dto.merchantId !== actor.merchantId) {
        throw new ForbiddenException('No autorizado para asignar otra razon social');
      }
      dto.merchantId = actor.merchantId;
    }
    if (actorRole === Role.POS_ADMIN) {
      throw new ForbiddenException('No autorizado para crear usuarios desde un PDV');
    }

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
    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand || brand.tenantId !== targetTenantId) {
        throw new BadRequestException('Marca invalida');
      }
    }
    if (dto.merchantId) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: dto.merchantId } });
      if (!merchant || merchant.tenantId !== targetTenantId) {
        throw new BadRequestException('Razon social invalida');
      }
    }
    let resolvedMerchantId = dto.merchantId ?? null;
    if (dto.pointOfSaleId) {
      const pointOfSale = await this.prisma.branch.findUnique({ where: { id: dto.pointOfSaleId } });
      if (!pointOfSale || pointOfSale.tenantId !== targetTenantId) {
        throw new BadRequestException('Punto de venta invalido');
      }
      resolvedMerchantId = pointOfSale.merchantId;
      if (dto.merchantId && dto.merchantId !== pointOfSale.merchantId) {
        throw new BadRequestException('El punto de venta no pertenece a la razon social indicada');
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
        brandId: brandRoles.has(dto.role) ? dto.brandId ?? null : null,
        merchantId: legalEntityRoles.has(dto.role) || posRoles.has(dto.role) ? resolvedMerchantId : null,
        bankBranchId: branchRoles.has(dto.role) ? dto.bankBranchId ?? null : null,
        pointOfSaleId: posRoles.has(dto.role) ? dto.pointOfSaleId ?? null : null,
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
        brandId: true,
        merchantId: true,
        bankBranchId: true,
        pointOfSaleId: true,
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
          brandId: true,
          merchantId: true,
          bankBranchId: true,
          pointOfSaleId: true,
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
      brandId: user.brandId,
      merchantId: user.merchantId,
      bankBranchId: user.bankBranchId,
      pointOfSaleId: user.pointOfSaleId,
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
