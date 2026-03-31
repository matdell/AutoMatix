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

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev_secret',
        signOptions: { expiresIn: '24h' },
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
