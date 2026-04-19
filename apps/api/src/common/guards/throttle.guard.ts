import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Simple in-memory rate limiter for Phase 0.
 * Production: replace with @nestjs/throttler backed by Redis.
 *
 * Default: 60 requests per minute per IP.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ThrottleGuard.name);
  private readonly store = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor() {
    this.limit = parseInt(process.env.RATE_LIMIT ?? '60', 10);
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.store.set(key, entry);
    }

    entry.count++;

    if (entry.count > this.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', retryAfter.toString());
      response.setHeader('X-RateLimit-Limit', this.limit.toString());
      response.setHeader('X-RateLimit-Remaining', '0');
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', this.limit.toString());
    response.setHeader('X-RateLimit-Remaining', (this.limit - entry.count).toString());

    return true;
  }
}
