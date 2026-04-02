import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

const roleHierarchy: Record<Role, Role[]> = {
  SUPERADMIN: [],
  BANK_ADMIN: [],
  BANK_OPS: [],
  BANK_APPROVER: [],
  BANK_BRANCH_MANAGER: [],
  BANK_BRANCH_OPERATOR: [],
  BRAND_ADMIN: [],
  LEGAL_ENTITY_ADMIN: [],
  POS_ADMIN: [],
  MERCHANT_ADMIN: [],
  MERCHANT_USER: [],
  ADMIN: [Role.BANK_ADMIN, Role.BANK_OPS],
  MERCHANT: [Role.MERCHANT_USER],
  OPERATIONS: [Role.BANK_OPS],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<{ user?: { role?: Role } }>();
    const userRole = user?.role;
    if (!userRole) {
      return false;
    }
    if (userRole === Role.SUPERADMIN) {
      return true;
    }
    const inherited = roleHierarchy[userRole] ?? [];
    const effectiveRoles = new Set<Role>([userRole, ...inherited]);
    return requiredRoles.some((role) => effectiveRoles.has(role));
  }
}
