import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

type SsoProvider = 'google' | 'microsoft';

interface SsoProfile {
  email: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
}

interface SsoState {
  provider: SsoProvider;
  tenantSlug?: string;
  returnTo?: string;
}

@Injectable()
export class SsoService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  buildStartUrl(provider: SsoProvider, state: SsoState): string {
    const cfg = this.getProviderConfig(provider);
    const scope = encodeURIComponent('openid email profile');
    const encodedState = this.encodeState(state);
    const prompt = provider === 'google' ? '&prompt=select_account' : '&prompt=select_account';

    return provider === 'google'
      ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}&response_type=code&scope=${scope}&state=${encodedState}${prompt}`
      : `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId ?? 'common')}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}&response_type=code&response_mode=query&scope=${scope}&state=${encodedState}${prompt}`;
  }

  async handleCallback(provider: SsoProvider, code: string, stateRaw: string, ipAddress?: string, userAgent?: string) {
    if (!code) throw new BadRequestException('Authorization code is required');

    const state = this.decodeState(stateRaw);
    if (state.provider !== provider) {
      throw new BadRequestException('Invalid SSO state');
    }

    const profile = await this.fetchProfile(provider, code);
    if (!profile.email) {
      throw new UnauthorizedException('SSO profile did not include an email address');
    }
    if (profile.emailVerified === false) {
      throw new ForbiddenException('Your SSO email address is not verified');
    }

    const user = await this.resolveUser(profile.email.toLowerCase(), state.tenantSlug);
    const session = await this.authService.signInWithUser(user.id, ipAddress, userAgent);

    return {
      session,
      returnTo: state.returnTo ?? '/dashboard',
      tenantSlug: user.tenant.slug,
    };
  }

  private async resolveUser(email: string, tenantSlug?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        email,
        status: 'ACTIVE',
        ...(tenantSlug ? { tenant: { slug: tenantSlug, isActive: true } } : {}),
      },
      include: { tenant: { select: { slug: true, isActive: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (users.length === 0) {
      throw new UnauthorizedException('No active user is linked to this SSO account');
    }
    if (users.length > 1 && !tenantSlug) {
      throw new ConflictException('Multiple companies use this email. Retry with a tenant slug.');
    }

    return users[0];
  }

  private async fetchProfile(provider: SsoProvider, code: string): Promise<SsoProfile> {
    const cfg = this.getProviderConfig(provider);
    const tokenEndpoint =
      provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId ?? 'common')}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException(`SSO token exchange failed (${tokenResponse.status})`);
    }

    const tokenJson = await tokenResponse.json() as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new UnauthorizedException('SSO access token was not returned');
    }

    const profileResponse = await fetch(
      provider === 'google'
        ? 'https://openidconnect.googleapis.com/v1/userinfo'
        : 'https://graph.microsoft.com/oidc/userinfo',
      {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      },
    );

    if (!profileResponse.ok) {
      throw new UnauthorizedException(`Failed to fetch SSO profile (${profileResponse.status})`);
    }

    const profile = await profileResponse.json() as any;
    return {
      email: profile.email ?? profile.preferred_username ?? profile.userPrincipalName,
      name: profile.name,
      picture: profile.picture ?? profile.photo,
      emailVerified: profile.email_verified ?? false,
    };
  }

  private getProviderConfig(provider: SsoProvider) {
    if (provider === 'google') {
      const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID');
      const clientSecret = this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
      const redirectUri = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI');
      if (!clientId || !clientSecret || !redirectUri) {
        throw new BadRequestException('Google SSO is not configured');
      }
      return { clientId, clientSecret, redirectUri };
    }

    const clientId = this.config.get<string>('MICROSOFT_OAUTH_CLIENT_ID');
    const clientSecret = this.config.get<string>('MICROSOFT_OAUTH_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('MICROSOFT_OAUTH_REDIRECT_URI');
    const tenantId = this.config.get<string>('MICROSOFT_OAUTH_TENANT_ID', 'common');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Microsoft SSO is not configured');
    }
    return { clientId, clientSecret, redirectUri, tenantId };
  }

  private encodeState(state: SsoState) {
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  private decodeState(state: string): SsoState {
    try {
      return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as SsoState;
    } catch {
      throw new BadRequestException('Invalid SSO state');
    }
  }
}
