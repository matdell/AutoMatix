import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/auth.types';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET')?.trim();
    const isProduction = config.get<string>('NODE_ENV') === 'production';
    if (!jwtSecret) {
      throw new Error('JWT_SECRET es obligatorio.');
    }
    if (isProduction && jwtSecret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        role: true,
        email: true,
        brandId: true,
        merchantId: true,
        bankBranchId: true,
        pointOfSaleId: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no autorizado');
    }
    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      brandId: user.brandId ?? null,
      merchantId: user.merchantId ?? null,
      bankBranchId: user.bankBranchId ?? null,
      pointOfSaleId: user.pointOfSaleId ?? null,
    };
  }
}
