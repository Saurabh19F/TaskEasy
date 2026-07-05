import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    const refreshSecret =
      configService.get<string>('JWT_REFRESH_SECRET') ??
      configService.get<string>('JWT_ACCESS_SECRET') ??
      configService.get<string>('JWT_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Accept refresh token from httpOnly cookie OR Authorization header
        (req: Request) => req?.cookies?.refreshToken || null,
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken =
      req?.cookies?.refreshToken || req.body?.refreshToken || null;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    return { ...payload, refreshToken };
  }
}
