import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const Redis = (await import('ioredis')).default;
        const redisUrl = config.get<string>('REDIS_URL');
        const client = redisUrl
          ? new Redis(redisUrl)
          : new Redis({
              host: config.get('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
              password: config.get('REDIS_PASSWORD') || undefined,
              retryStrategy: (times) => Math.min(times * 50, 2000),
          });

        client.on('error', (error) => {
          logger.warn(`Redis connection error: ${error.message}`);
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
