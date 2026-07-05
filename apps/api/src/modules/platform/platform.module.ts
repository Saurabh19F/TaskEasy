import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'platform-jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get('PLATFORM_JWT_ACCESS_SECRET') ??
          config.get('JWT_ACCESS_SECRET') ??
          config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('PLATFORM_JWT_ACCESS_EXPIRY', '15m') },
      }),
    }),
  ],
  controllers: [PlatformAuthController, PlatformController],
  providers: [PlatformAuthService, PlatformService, PlatformJwtStrategy],
  exports: [PlatformAuthService, PlatformService, JwtModule],
})
export class PlatformModule {}
