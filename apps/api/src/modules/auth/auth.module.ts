import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtRefreshInterceptor } from '../common/jwt-refresh.interceptor';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: (() => {
          const jwtSecret = config.get<string>('JWT_SECRET')?.trim();
          const isProduction = config.get<string>('NODE_ENV') === 'production';
          if (!jwtSecret) {
            throw new Error('JWT_SECRET es obligatorio.');
          }
          if (isProduction && jwtSecret.length < 32) {
            throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
          }
          return jwtSecret;
        })(),
        signOptions: { expiresIn: '24h', algorithm: 'HS256' },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: JwtRefreshInterceptor,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
