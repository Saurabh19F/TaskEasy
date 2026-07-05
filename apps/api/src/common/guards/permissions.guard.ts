import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';
import { Permission, ROLE_PERMISSIONS } from '../constants/permissions';
import { isTenantWideRole } from '../utils/role.utils';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermissions() decorator → skip check
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) throw new ForbiddenException('User not authenticated');

    if (isTenantWideRole(user.role)) return true;

    // Merge stored JWT permissions with role-default permissions so that
    // changes to ROLE_PERMISSIONS take effect immediately without requiring
    // users to log out and back in or a DB migration.
    const userPermissions = new Set([
      ...(user.permissions || []),
      ...(ROLE_PERMISSIONS[user.role] || []),
    ]);

    const missing = requiredPermissions.filter((p) => !userPermissions.has(p));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
