import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  merchantId?: string | null;
  bankBranchId?: string | null;
}
