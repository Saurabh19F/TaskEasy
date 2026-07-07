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

        const commonOpts = {
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) => Math.min(times * 200, 5000),
          lazyConnect: true,
          enableOfflineQueue: true,
          reconnectOnError: () => true,
        };

        const client = redisUrl
          ? new Redis(redisUrl, commonOpts)
          : new Redis({
              host: config.get('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
              password: config.get('REDIS_PASSWORD') || undefined,
              ...commonOpts,
          });

        client.on('error', (error) => {
          logger.warn(`Redis connection error: ${error.message}`);
        });

        client.on('connect', () => {
          logger.log('Redis connected');
        });

        try {
          await client.connect();
        } catch (err) {
          logger.warn(`Redis initial connection failed — app will continue without cache: ${err.message}`);
        }

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
