import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { RedisService } from '../../redis/redis.service';

const DEFAULT_TTL = 60; // seconds

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();

    // Only cache GET requests for authenticated users
    if (req.method !== 'GET' || !req.user) return next.handle();

    const key = this.buildKey(req);
    const cached = await this.redis.get(key);

    if (cached) {
      return of(JSON.parse(cached));
    }

    return next.handle().pipe(
      tap(async (data) => {
        if (data !== undefined && data !== null) {
          await this.redis.set(key, JSON.stringify(data), DEFAULT_TTL);
        }
      }),
    );
  }

  private buildKey(req: any): string {
    const user = req.user;
    const query = new URLSearchParams(req.query).toString();
    return `cache:${user.tenantId}:${user.sub}:${req.path}:${query}`;
  }
}
