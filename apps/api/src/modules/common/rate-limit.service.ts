import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, RateEntry>();

  constructor(private config: ConfigService) {}

  private getNow() {
    return Date.now();
  }

  private cleanup(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  resolveClientIp(request: { headers?: Record<string, unknown>; ip?: string }) {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      const first = forwardedFor[0];
      if (typeof first === 'string' && first.trim()) {
        return first.split(',')[0].trim();
      }
    }
    return request.ip || 'unknown';
  }

  getLimit(name: string, fallback: number) {
    const raw = this.config.get<string>(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  getWindowMs(name: string, fallbackMs: number) {
    const raw = this.config.get<string>(name);
    if (!raw) return fallbackMs;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallbackMs;
    }
    return Math.floor(parsed);
  }

  consumeOrThrow(params: { key: string; limit: number; windowMs: number; message?: string }) {
    const now = this.getNow();
    this.cleanup(now);

    const current = this.entries.get(params.key);
    if (!current || current.resetAt <= now) {
      this.entries.set(params.key, {
        count: 1,
        resetAt: now + params.windowMs,
      });
      return;
    }

    current.count += 1;
    if (current.count > params.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new HttpException(
        params.message || `Demasiados intentos. Reintenta en ${retryAfterSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
