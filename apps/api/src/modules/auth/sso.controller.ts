import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SsoService } from './sso.service';

@ApiTags('auth')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Public()
  @Get(':provider/start')
  @ApiOperation({ summary: 'Start Google or Microsoft SSO login' })
  start(
    @Param('provider') provider: 'google' | 'microsoft',
    @Query('tenantSlug') tenantSlug: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    const url = this.ssoService.buildStartUrl(provider, {
      provider,
      tenantSlug,
      returnTo,
    });
    return res.redirect(url);
  }

  @Public()
  @Get(':provider/callback')
  @ApiOperation({ summary: 'Complete Google or Microsoft SSO login' })
  async callback(
    @Param('provider') provider: 'google' | 'microsoft',
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    const { session, returnTo } = await this.ssoService.handleCallback(
      provider,
      code,
      state,
      ipAddress,
      userAgent,
    );

    res.cookie('refreshToken', session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}${returnTo}`);
  }
}
