import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  scope?: 'platform';
  impersonatingTenantId?: string | null;
  iat?: number;
  exp?: number;
}

export const CurrentPlatformUser = createParamDecorator(
  (data: keyof PlatformJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: PlatformJwtPayload = request.user;
    return data ? user?.[data] : user;
  },
);
