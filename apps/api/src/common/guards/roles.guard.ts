import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';
import { isTenantWideRole, normalizeCompanyRole } from '../utils/role.utils';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → any authenticated user is allowed
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) throw new ForbiddenException('User not authenticated');

    const userRole = normalizeCompanyRole(user.role);
    const normalizedRequiredRoles = requiredRoles.map((role) => normalizeCompanyRole(role));

    if (isTenantWideRole(user.role)) return true;

    if (!normalizedRequiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Role '${user.role}' is not authorized for this action. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
