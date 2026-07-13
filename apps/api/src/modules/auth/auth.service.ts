import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { QUEUES } from '../../queue/queue.constants';
import { parseDurationToMs } from '../../common/utils/duration.utils';
import { validatePasswordStrength } from '../../common/utils/password.utils';
import { normalizeCompanyRole } from '../../common/utils/role.utils';
import {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/login.dto';
import { resolvePermissions } from '../../common/constants/permissions';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
    @InjectQueue(QUEUES.EMAIL) private emailQueue: Queue,
  ) {}

  // ── Login ────────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      include: {
        tenant: {
          select: { id: true, name: true, isActive: true, slug: true },
        },
      },
    });

    // Always log attempt before throwing (prevents user enumeration timing)
    const logFailure = async (reason: string) => {
      if (user) {
        await this.prisma.loginHistory.create({
          data: { userId: user.id, ipAddress, userAgent, success: false, failReason: reason },
        });
      }
    };

    if (!user) {
      await logFailure('User not found');
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check tenant active
    if (!user.tenant.isActive) {
      await logFailure('Tenant inactive');
      throw new ForbiddenException('Your company account is inactive. Contact support.');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logFailure('Account locked');
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account locked. Try again in ${minutesLeft} minute(s).`,
      );
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      await logFailure(`Account status: ${user.status}`);
      throw new ForbiddenException('Your account is inactive. Contact your administrator.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const newFailedCount = user.failedLoginAttempts + 1;
      const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      });
      await logFailure('Invalid password');
      if (shouldLock) {
        throw new ForbiddenException(
          `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`,
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('2FA code required');
      }
      // SEC-06 fix: guard against null secret before calling authenticator
      if (!user.twoFactorSecret) {
        throw new UnauthorizedException('2FA is misconfigured — please contact support');
      }
      const isValid = authenticator.verify({
        token: dto.totpCode,
        secret: user.twoFactorSecret,
      });
      if (!isValid) {
        await logFailure('Invalid 2FA code');
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Reset failed attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // Log success
    await this.prisma.loginHistory.create({
      data: { userId: user.id, ipAddress, userAgent, success: true },
    });

    // Issue tokens
    const role = normalizeCompanyRole(user.role);
    const permissions = resolvePermissions(role, user.permissions);
    const tokens = await this.issueTokens(user.id, user.tenantId, user.email, role, permissions);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        tenantSlug: user.tenant.slug,
        avatarUrl: user.avatarUrl,
        permissions,
      },
    };
  }

  async signInWithUser(userId: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: { id: true, name: true, isActive: true, slug: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.tenant.isActive) {
      throw new ForbiddenException('Your company account is inactive. Contact support.');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is inactive. Contact your administrator.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        success: true,
      },
    });

    const role = normalizeCompanyRole(user.role);
    const permissions = resolvePermissions(role, user.permissions);
    const tokens = await this.issueTokens(user.id, user.tenantId, user.email, role, permissions);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        tenantSlug: user.tenant.slug,
        avatarUrl: user.avatarUrl,
        permissions,
      },
    };
  }

  // ── Token Refresh ────────────────────────────────────────────

  async refresh(userId: string, tenantId: string, rawRefreshToken: string) {
    const tokenHash = await this.hashToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, permissions: true, tenantId: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const role = normalizeCompanyRole(user.role);
    const permissions = resolvePermissions(role, user.permissions);
    return this.issueTokens(user.id, user.tenantId, user.email, role, permissions);
  }

  // ── Logout ───────────────────────────────────────────────────

  async logout(userId: string, rawRefreshToken: string) {
    if (rawRefreshToken) {
      const tokenHash = await this.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'All sessions terminated' };
  }

  // ── Forgot Password ──────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const resetToken = uuidv4();
    const tokenHash = await this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hashed token in Redis (TTL: 1 hour)
    await this.redis.set(
      `password-reset:${tokenHash}`,
      { userId: user.id, email: user.email },
      3600,
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    await this.emailQueue.add('send-email', {
      to: user.email,
      subject: '🔑 Reset Your TaskEasy Password',
      template: 'password-reset',
      data: {
        name: user.name,
        resetUrl,
        expiryMinutes: 60,
      },
    });

    this.logger.log(`Password reset email queued for ${user.email}`);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // ── Reset Password ───────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = await this.hashToken(dto.token);
    const stored = await this.redis.get<{ userId: string }>(`password-reset:${tokenHash}`);

    if (!stored) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    this.validatePasswordStrength(dto.newPassword);

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash: newHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.redis.del(`password-reset:${tokenHash}`);
    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ── Change Password ──────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    this.validatePasswordStrength(dto.newPassword);

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all other sessions
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed. Please log in again.' };
  }

  // ── 2FA Setup ────────────────────────────────────────────────

  async setup2FA(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(email, 'TaskEasy', secret);
    const qrDataUrl = await qrcode.toDataURL(otpAuthUrl);

    // Store secret temporarily (not enabled yet until verified)
    await this.redis.set(`2fa-setup:${userId}`, secret, 600); // 10 min

    return { secret, qrDataUrl };
  }

  async verify2FA(userId: string, totpCode: string) {
    const secret = await this.redis.get<string>(`2fa-setup:${userId}`);
    if (!secret) throw new BadRequestException('2FA setup session expired. Please restart.');

    const isValid = authenticator.verify({ token: totpCode, secret });
    if (!isValid) throw new BadRequestException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorSecret: secret },
    });
    await this.redis.del(`2fa-setup:${userId}`);

    return { message: '2FA enabled successfully' };
  }

  async disable2FA(userId: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');

    const isValid = authenticator.verify({ token: totpCode, secret: user.twoFactorSecret });
    if (!isValid) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return { message: '2FA disabled' };
  }

  // ── Sessions ─────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { message: 'Session revoked' };
  }

  // ── Me ───────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        gender: true,
        dateOfBirth: true,
        department: true,
        designation: true,
        employeeId: true,
        address: true,
        city: true,
        state: true,
        country: true,
        pinCode: true,
        joiningDate: true,
        employmentType: true,
        workMode: true,
        workLocation: true,
        employeeStatus: true,
        tenantId: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: true,
        tenant: {
          select: { name: true, slug: true, timezone: true, logoUrl: true },
        },
      } as any,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Private Helpers ──────────────────────────────────────────

  private async issueTokens(
    userId: string,
    tenantId: string,
    email: string,
    role: string,
    permissions: string[],
  ) {
    const payload = { sub: userId, tenantId, email, role, permissions };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:
          this.configService.get('JWT_ACCESS_SECRET') ??
          this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '7d'),
      }),
      this.jwtService.signAsync(
        { sub: userId, tenantId },
        {
          secret:
            this.configService.get('JWT_REFRESH_SECRET') ??
            this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
        },
      ),
    ]);

    const tokenHash = await this.hashToken(refreshToken);
    const refreshExpiryMs = parseDurationToMs(
      this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
      7 * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiryMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private validatePasswordStrength(password: string): void {
    validatePasswordStrength(password);
  }
}
