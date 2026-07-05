import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';
import { resolvePermissions } from '../../../common/constants/permissions';
import { normalizeCompanyRole } from '../../../common/utils/role.utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ??
        configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Verify user still exists and is active
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        status: 'ACTIVE',
      },
      select: { id: true, role: true, permissions: true, tenantId: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Return enriched payload (role's baseline permissions merged with this
    // user's direct overrides) — must match the same merge AuthService does
    // when it signs the token, or every @RequirePermissions() route silently
    // 403s for everyone except SAAS_OWNER (who bypasses the guard).
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      role: normalizeCompanyRole(user.role),
      permissions: resolvePermissions(normalizeCompanyRole(user.role), user.permissions),
    };
  }
}
