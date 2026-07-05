import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_JWT_KEY } from '../decorators/skip-jwt.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipJwt = this.reflector.getAllAndOverride<boolean>(SKIP_JWT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipJwt) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.tenantId) {
      // JwtAuthGuard normally populates request.user later in the pipeline,
      // but this global guard can run first. Preserve the tenant context for
      // downstream services whenever it is already available.
      request.tenantId = user.tenantId;
      return true;
    }

    // Platform admin tokens have no tenantId — skip tenant enforcement for them.
    if (user?.scope === 'platform') {
      return true;
    }

    throw new ForbiddenException('Tenant context is missing');
  }
}
