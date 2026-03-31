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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notifications: NotificationsService,
  ) {}

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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: bank.id,
      role: user.role,
      email: user.email,
      merchantId: user.merchantId,
      bankBranchId: user.bankBranchId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        tenantId: bank.id,
        bankBranchId: user.bankBranchId ?? null,
      },
    };
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
}
