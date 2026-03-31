import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { JwtPayload } from './auth.types';

type RequestUser = {
  userId: string;
  tenantId: string;
  role: JwtPayload['role'];
  email: string;
  brandId?: string | null;
  merchantId?: string | null;
  bankBranchId?: string | null;
  pointOfSaleId?: string | null;
};

@Injectable()
export class JwtRefreshInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ user?: RequestUser }>();
    const response = http.getResponse();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const payload: JwtPayload = {
          sub: user.userId,
          tenantId: user.tenantId,
          role: user.role,
          email: user.email,
          brandId: user.brandId ?? undefined,
          merchantId: user.merchantId ?? undefined,
          bankBranchId: user.bankBranchId ?? undefined,
          pointOfSaleId: user.pointOfSaleId ?? undefined,
        };
        const token = this.jwtService.sign(payload);
        response.setHeader('x-access-token', token);
      }),
    );
  }
}
