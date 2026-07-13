import { Module, OnModuleInit, Logger } from '@nestjs/common';
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
export class PlatformModule implements OnModuleInit {
  private readonly logger = new Logger(PlatformModule.name);

  constructor(
    private readonly authService: PlatformAuthService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.configService.get<string>(
      'SEED_SUPER_ADMIN_EMAIL',
      'superadmin@taskeasy.app',
    );
    const password = this.configService.get<string>(
      'SEED_SUPER_ADMIN_PASSWORD',
      'Admin@1234',
    );

    try {
      await this.authService.createInitialSuperAdmin(email, password);
      this.logger.log(`Platform super-admin seeded: ${email}`);
    } catch (err) {
      this.logger.warn(`Platform super-admin seed skipped: ${(err as Error).message}`);
    }
  }
}
