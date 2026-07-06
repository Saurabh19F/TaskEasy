import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { SkipJwtGuard } from '../../common/decorators/skip-jwt.decorator';
import { CurrentPlatformUser, PlatformJwtPayload } from '../../common/decorators/platform-current-user.decorator';
import { PlatformJwtAuthGuard } from '../../common/guards/platform-jwt-auth.guard';
import { PlatformAuthService } from './platform-auth.service';

const isProduction = process.env.NODE_ENV === 'production';

function platformRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

@ApiTags('platform-auth')
@SkipJwtGuard()
@UseGuards(PlatformJwtAuthGuard)
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly platformAuthService: PlatformAuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login to platform console' })
  async login(
    @Body() dto: { email: string; password: string; totpCode?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    const result = await this.platformAuthService.login(dto, ipAddress, userAgent);

    res.cookie('platformRefreshToken', result.refreshToken, platformRefreshCookieOptions());

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh platform token' })
  async refresh(
    @Req() req: Request,
    @Body() dto: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.platformRefreshToken || dto.refreshToken;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    let decoded: { sub: string };
    try {
      decoded = this.jwtService.verify(rawRefreshToken, {
        secret:
          this.configService.get<string>('PLATFORM_JWT_REFRESH_SECRET') ??
          this.configService.get<string>('JWT_REFRESH_SECRET') ??
          this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired platform refresh token');
    }
    const result = await this.platformAuthService.refresh(decoded.sub, rawRefreshToken);

    res.cookie('platformRefreshToken', result.refreshToken, platformRefreshCookieOptions());

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  logout(
    @CurrentPlatformUser() user: PlatformJwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.platformRefreshToken;
    res.clearCookie('platformRefreshToken', { path: '/' });
    return this.platformAuthService.logout(user.sub, rawRefreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  logoutAll(
    @CurrentPlatformUser() user: PlatformJwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('platformRefreshToken', { path: '/' });
    return this.platformAuthService.logoutAll(user.sub);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current platform user' })
  me(@CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.platformAuthService.getMe(user.sub);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change current platform password' })
  changePassword(
    @CurrentPlatformUser() user: PlatformJwtPayload,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.platformAuthService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

}
