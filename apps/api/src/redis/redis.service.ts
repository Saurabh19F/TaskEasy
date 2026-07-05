import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ── Basic Operations ─────────────────────────────────────────

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.redis.exists(key);
    return count > 0;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  // ── Pattern Delete (for cache invalidation) ─────────────────

  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return 0;
    await this.redis.del(...keys);
    this.logger.debug(`Deleted ${keys.length} keys matching: ${pattern}`);
    return keys.length;
  }

  // ── Increment (for counters) ─────────────────────────────────

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    return this.redis.incrby(key, amount);
  }

  // ── Hash Operations ──────────────────────────────────────────

  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.redis.hset(key, field, JSON.stringify(value));
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const value = await this.redis.hget(key, field);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, JSON.parse(v)])
    ) as T;
  }

  // ── Set Operations (for token blacklisting) ──────────────────

  async sadd(key: string, ...members: string[]): Promise<void> {
    await this.redis.sadd(key, ...members);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.redis.sismember(key, member)) === 1;
  }

  // ── Health Check ─────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
