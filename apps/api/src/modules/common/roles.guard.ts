import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

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
    const { user } = context.switchToHttp().getRequest();
    if (user?.role === Role.SUPERADMIN) {
      return true;
    }
    const effectiveRoles = new Set<Role>([user?.role]);
    if (user?.role === Role.ADMIN) {
      effectiveRoles.add(Role.BANK_ADMIN);
      effectiveRoles.add(Role.BANK_OPS);
    }
    if (user?.role === Role.OPERATIONS) {
      effectiveRoles.add(Role.BANK_OPS);
    }
    if (user?.role === Role.MERCHANT) {
      effectiveRoles.add(Role.MERCHANT_USER);
    }
    if (user?.role === Role.MERCHANT_USER) {
      effectiveRoles.add(Role.POS_ADMIN);
      effectiveRoles.add(Role.LEGAL_ENTITY_ADMIN);
    }
    if (user?.role === Role.BANK_ADMIN) {
      effectiveRoles.add(Role.BANK_OPS);
    }
    if (user?.role === Role.BANK_BRANCH_MANAGER) {
      effectiveRoles.add(Role.BANK_BRANCH_OPERATOR);
    }
    if (user?.role === Role.BRAND_ADMIN) {
      effectiveRoles.add(Role.LEGAL_ENTITY_ADMIN);
      effectiveRoles.add(Role.POS_ADMIN);
    }
    if (user?.role === Role.LEGAL_ENTITY_ADMIN) {
      effectiveRoles.add(Role.POS_ADMIN);
    }
    if (user?.role === Role.MERCHANT_ADMIN) {
      effectiveRoles.add(Role.MERCHANT_USER);
      effectiveRoles.add(Role.LEGAL_ENTITY_ADMIN);
      effectiveRoles.add(Role.POS_ADMIN);
    }
    return requiredRoles.some((role) => effectiveRoles.has(role));
  }
}
