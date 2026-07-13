import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecuritySettingsService } from '../../modules/security-settings/security-settings.service';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly securitySettings: SecuritySettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.tenantId) return true;

    const ip = this.extractIp(request);
    const allowed = await this.securitySettings.isIpAllowed(user.tenantId, ip);

    if (!allowed) {
      throw new ForbiddenException(
        'Access denied: your IP address is not whitelisted',
      );
    }

    return true;
  }

  private extractIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded : forwarded[0])
        .split(',')[0]
        .trim();
    }
    return request.ip?.replace('::ffff:', '') ?? '0.0.0.0';
  }
}
