import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ── Basic Operations ─────────────────────────────────────────

  private get isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (err) {
      this.logger.warn(`Redis GET failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (err) {
      this.logger.warn(`Redis SET failed for key "${key}": ${err.message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis DEL failed for ${keys.length} key(s): ${err.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.redis.exists(key);
      return count > 0;
    } catch (err) {
      this.logger.warn(`Redis EXISTS failed for key "${key}": ${err.message}`);
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.expire(key, ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis EXPIRE failed for key "${key}": ${err.message}`);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (err) {
      this.logger.warn(`Redis TTL failed for key "${key}": ${err.message}`);
      return -1;
    }
  }

  // ── Pattern Delete (for cache invalidation) ─────────────────

  async delByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      await this.redis.del(...keys);
      this.logger.debug(`Deleted ${keys.length} keys matching: ${pattern}`);
      return keys.length;
    } catch (err) {
      this.logger.warn(`Redis delByPattern failed for "${pattern}": ${err.message}`);
      return 0;
    }
  }

  // ── Increment (for counters) ─────────────────────────────────

  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (err) {
      this.logger.warn(`Redis INCR failed for key "${key}": ${err.message}`);
      return 0;
    }
  }

  async incrBy(key: string, amount: number): Promise<number> {
    try {
      return await this.redis.incrby(key, amount);
    } catch (err) {
      this.logger.warn(`Redis INCRBY failed for key "${key}": ${err.message}`);
      return 0;
    }
  }

  // ── Hash Operations ──────────────────────────────────────────

  async hset(key: string, field: string, value: unknown): Promise<void> {
    try {
      await this.redis.hset(key, field, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`Redis HSET failed for key "${key}": ${err.message}`);
    }
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.warn(`Redis HGET failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.hgetall(key);
      if (!data || Object.keys(data).length === 0) return null;
      return Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, JSON.parse(v)])
      ) as T;
    } catch (err) {
      this.logger.warn(`Redis HGETALL failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  // ── Set Operations (for token blacklisting) ──────────────────

  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.sadd(key, ...members);
    } catch (err) {
      this.logger.warn(`Redis SADD failed for key "${key}": ${err.message}`);
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      return (await this.redis.sismember(key, member)) === 1;
    } catch (err) {
      this.logger.warn(`Redis SISMEMBER failed for key "${key}": ${err.message}`);
      return false;
    }
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
