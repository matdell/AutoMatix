import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  brandId?: string | null;
  merchantId?: string | null;
  bankBranchId?: string | null;
  pointOfSaleId?: string | null;
}
