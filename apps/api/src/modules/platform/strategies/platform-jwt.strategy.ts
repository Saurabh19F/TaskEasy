import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlatformJwtPayload } from '../../../common/decorators/platform-current-user.decorator';
import { resolvePermissions } from '../../../common/constants/permissions';
import { normalizePlatformRole } from '../../../common/utils/role.utils';

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('PLATFORM_JWT_ACCESS_SECRET') ??
        configService.get<string>('JWT_ACCESS_SECRET') ??
        configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformJwtPayload> {
    const platformUser = await this.prisma.platformUser.findFirst({
      where: {
        id: payload.sub,
        status: 'ACTIVE',
      },
      select: { id: true, email: true, role: true, permissions: true, status: true },
    });

    if (!platformUser) {
      throw new UnauthorizedException('Platform user not found or inactive');
    }

    const role = normalizePlatformRole(platformUser.role);
    const permissions = resolvePermissions(role, platformUser.permissions);

    return {
      sub: platformUser.id,
      email: platformUser.email,
      role,
      permissions,
      scope: 'platform',
    };
  }
}
