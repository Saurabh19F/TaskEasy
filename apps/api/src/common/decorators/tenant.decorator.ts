import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Usage: @TenantId() tenantId: string
 * Extracts tenantId directly from the JWT payload (set by TenantGuard).
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);
