import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { isCentralPlatformMode } from './platform-mode';

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

const centralSuperadminAllowedPrefixes = ['/banks', '/users', '/auth', '/bank-provisioning'];

function normalizePath(value?: string) {
  if (!value) {
    return '';
  }
  const withoutQuery = value.split('?')[0] ?? '';
  return withoutQuery.startsWith('/api/') ? withoutQuery.slice(4) : withoutQuery;
}

function isCentralSuperadminPathAllowed(path: string) {
  return centralSuperadminAllowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

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
      if (isCentralPlatformMode()) {
        const request = context.switchToHttp().getRequest<{ path?: string; originalUrl?: string }>();
        const path = normalizePath(request.path || request.originalUrl);
        if (!isCentralSuperadminPathAllowed(path)) {
          return false;
        }
        return requiredRoles.includes(Role.SUPERADMIN);
      }
      return true;
    }
    const inherited = roleHierarchy[userRole] ?? [];
    const effectiveRoles = new Set<Role>([userRole, ...inherited]);
    return requiredRoles.some((role) => effectiveRoles.has(role));
  }
}
