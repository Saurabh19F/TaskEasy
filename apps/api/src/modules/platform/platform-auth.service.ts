import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformJwtPayload } from '../../common/decorators/platform-current-user.decorator';
import { parseDurationToMs } from '../../common/utils/duration.utils';
import { normalizePlatformRole } from '../../common/utils/role.utils';

const PLATFORM_BCRYPT_ROUNDS = 12;

@Injectable()
export class PlatformAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: { email: string; password: string; totpCode?: string }, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.platformUser.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Your platform account is inactive.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked. Please try again later.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const failed = user.failedLoginAttempts + 1;
      await this.prisma.platformUser.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failed,
          lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('2FA code required');
      }
      // TS-03 fix: null secret would cause otplib to throw instead of return false
      if (!user.twoFactorSecret) {
        throw new UnauthorizedException('2FA is misconfigured — please contact support');
      }
      const ok = authenticator.verify({ token: dto.totpCode, secret: user.twoFactorSecret });
      if (!ok) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await this.prisma.platformLoginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        success: true,
      },
    });

    const role = normalizePlatformRole(user.role);
    const permissions = this.resolvePermissions(role, user.permissions);
    const tokens = await this.issueTokens(user.id, user.email, role, permissions);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role,
        permissions,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refresh(userId: string, rawRefreshToken: string) {
    const tokenHash = await this.hashToken(rawRefreshToken);
    const stored = await this.prisma.platformRefreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!stored) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, permissions: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Platform user not found or inactive');
    }

    await this.prisma.platformRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const role = normalizePlatformRole(user.role);
    const permissions = this.resolvePermissions(role, user.permissions);
    return this.issueTokens(user.id, user.email, role, permissions);
  }

  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = await this.hashToken(rawRefreshToken);
      await this.prisma.platformRefreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.platformRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'All platform sessions terminated' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Platform user not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // SEC-02 fix: full complexity check (not just length)
    const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, PLATFORM_BCRYPT_ROUNDS);
    await this.prisma.platformUser.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Revoke all existing refresh tokens so other sessions are invalidated
    await this.prisma.platformRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // MI-07 fix: password change is NOT a login event — removed loginHistory entry

    return { message: 'Password changed successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Platform user not found');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: normalizePlatformRole(user.role),
      permissions: user.permissions,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async createInitialSuperAdmin(email: string, password: string, name = 'Platform Admin') {
    const existing = await this.prisma.platformUser.findFirst({ where: { email: email.toLowerCase() } });
    if (existing) return existing;

    const passwordHash = await bcrypt.hash(password, PLATFORM_BCRYPT_ROUNDS);
    return this.prisma.platformUser.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: 'PLATFORM_ADMIN',
        status: 'ACTIVE',
        permissions: [],
      },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    permissions: string[],
  ) {
    const payload: PlatformJwtPayload = {
      sub: userId,
      email,
      role,
      permissions,
      scope: 'platform',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:
          this.configService.get('PLATFORM_JWT_ACCESS_SECRET') ??
          this.configService.get('JWT_ACCESS_SECRET') ??
          this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('PLATFORM_JWT_ACCESS_EXPIRY', '15m'),
      }),
      this.jwtService.signAsync(
        { sub: userId, scope: 'platform' },
        {
          secret:
            this.configService.get('PLATFORM_JWT_REFRESH_SECRET') ??
            this.configService.get('JWT_REFRESH_SECRET') ??
            this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('PLATFORM_JWT_REFRESH_EXPIRY', '7d'),
        },
      ),
    ]);

    const tokenHash = await this.hashToken(refreshToken);
    const refreshExpiryMs = parseDurationToMs(
      this.configService.get('PLATFORM_JWT_REFRESH_EXPIRY', '7d'),
      7 * 24 * 60 * 60 * 1000,
    );
    await this.prisma.platformRefreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiryMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private resolvePermissions(role: string, directPermissions: string[]): string[] {
    const fromRole = this.rolePermissions(normalizePlatformRole(role));
    return Array.from(new Set([...fromRole, ...directPermissions]));
  }

  private rolePermissions(role: string): string[] {
    const permsByRole: Record<string, string[]> = {
      PLATFORM_ADMIN: [
        'platform.companies.read', 'platform.companies.create', 'platform.companies.update',
        'platform.users.read', 'platform.users.create', 'platform.users.update',
        'platform.plans.manage', 'platform.billing.read', 'platform.audit.read', 'platform.reports.read',
      ],
      SUPPORT_AGENT: ['platform.companies.read', 'platform.support.manage', 'platform.audit.read'],
      BILLING_MANAGER: ['platform.billing.read', 'platform.billing.update', 'platform.plans.manage'],
      SALES_MANAGER: ['platform.companies.read', 'platform.companies.create', 'platform.plans.manage'],
      PLATFORM_AUDITOR: ['platform.companies.read', 'platform.billing.read', 'platform.audit.read', 'platform.reports.read'],
    };
    return permsByRole[role] ?? [];
  }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async recordFailedLogin(email: string, reason: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.platformUser.findFirst({ where: { email: email.toLowerCase() } });
    if (user) {
      await this.prisma.platformLoginHistory.create({        data: {
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
          failReason: reason,
        },
      });
    }
  }
}
