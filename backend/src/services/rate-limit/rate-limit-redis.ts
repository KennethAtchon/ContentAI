import { systemLogger } from "@/utils/system/system-logger";
import getRedisConnection from "@/services/db/redis";

const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

const BULK_RATE_LIMIT_WINDOW = 1;
const BULK_RATE_LIMIT_MAX_REQUESTS = 50;

const DEFAULT_KEY_PREFIX = "rate_limit";
const BULK_KEY_PREFIX = "bulk_rate_limit";

interface RateLimitOptions {
  window?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export async function checkRateLimit(
  ip: string,
  options?: RateLimitOptions,
): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const window = options?.window ?? RATE_LIMIT_WINDOW;
    const maxRequests = options?.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
    const keyPrefix = options?.keyPrefix ?? DEFAULT_KEY_PREFIX;
    const key = `${keyPrefix}:${ip}`;

    // Handle zero or negative max requests - should immediately block
    if (maxRequests <= 0) {
      return false;
    }

    const current = await redis.get(key);

    if (current === null) {
      await redis.setex(key, window, "1");
      return true;
    }

    const count = parseInt(current);
    if (count >= maxRequests) {
      return false;
    }

    // Increment counter
    await redis.incr(key);
    return true;
  } catch (error) {
    systemLogger.error(
      "Rate limit check failed",
      { service: "rate-limit", ip },
      error,
    );
    // SECURITY FIX (SEC-003): Fail secure - block requests when rate limiting is unavailable
    // This prevents DoS attacks during Redis outages
    return false; // Block request on error
  }
}

export async function checkRateLimitWithDetails(
  ip: string,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const redis = getRedisConnection();
    const window = options?.window ?? RATE_LIMIT_WINDOW;
    const maxRequests = options?.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
    const keyPrefix = options?.keyPrefix ?? DEFAULT_KEY_PREFIX;
    const key = `${keyPrefix}:${ip}`;

    const resetTime = Math.floor(Date.now() / 1000) + window;

    // Handle zero or negative max requests - should immediately block
    if (maxRequests <= 0) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    const current = await redis.get(key);

    if (current === null) {
      await redis.setex(key, window, "1");
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime,
      };
    }

    const count = parseInt(current);
    if (count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Increment counter
    await redis.incr(key);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - count - 1),
      resetTime,
    };
  } catch (error) {
    systemLogger.error(
      "Rate limit check with details failed",
      { service: "rate-limit", ip },
      error,
    );
    // SECURITY FIX (SEC-003): Fail secure - block requests when rate limiting is unavailable
    return {
      allowed: false, // Block request on error
      remaining: 0,
      resetTime:
        Math.floor(Date.now() / 1000) + (options?.window ?? RATE_LIMIT_WINDOW),
    };
  }
}

export async function checkBulkRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit(ip, {
    window: BULK_RATE_LIMIT_WINDOW,
    maxRequests: BULK_RATE_LIMIT_MAX_REQUESTS,
    keyPrefix: BULK_KEY_PREFIX,
  });
}
