import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev_secret',
    });
  }

  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
      merchantId: payload.merchantId ?? null,
      bankBranchId: payload.bankBranchId ?? null,
    };
  }
}
