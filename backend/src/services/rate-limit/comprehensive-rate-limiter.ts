import { checkRateLimit } from "./rate-limit-redis";
import { debugLog } from "@/utils/debug";
import { systemLogger } from "@/utils/system/system-logger";
import {
  getClientIp,
  getSecurityIp,
  extractUserIdFromToken,
} from "@/services/request-identity";
import {
  RATE_LIMIT_CONFIGS,
  getRateLimitConfig,
  shouldAlertOnExceed,
  type RateLimitType,
} from "@/constants/rate-limit.config";

// Re-export RateLimitType for convenience
export type { RateLimitType };

export {
  getClientIp,
  getSecurityIp,
  extractUserIdFromToken,
} from "@/services/request-identity";

/** Path segments used to classify routes for rate limiting (pathname.includes(segment)). Map order = match priority. */
const RATE_LIMIT_PATH_SEGMENTS = new Map<RateLimitType, readonly string[]>([
  ["auth", ["/auth/", "/login", "/register", "/verify"]],
  ["payment", ["/orders/create", "/payment", "/checkout"]],
  ["upload", ["/upload", "/upload-from-url"]],
  ["admin", ["/admin/"]],
  ["customer", ["/customer/"]],
  ["health", ["/health", "/ready", "/live", "/system"]],
  ["public", ["/public/"]],
]);

function pathMatchesSegments(
  pathname: string,
  segments: readonly string[],
): boolean {
  return segments.some((seg) => pathname.includes(seg));
}

/** Builds a JSON Response with the given status and headers. */
function jsonResponse(
  data: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Determines rate limit type based on the request path.
 */
export function determineRateLimitType(pathname: string): RateLimitType {
  for (const [rateLimitType, segments] of RATE_LIMIT_PATH_SEGMENTS) {
    if (pathMatchesSegments(pathname, segments)) return rateLimitType;
  }
  return "default";
}

/**
 * Gets a unique identifier for rate limiting.
 * Authenticated requests use the Firebase UID; unauthenticated use IP.
 */
async function getRateLimitKey(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token && token.length > 10) {
      const userId = await extractUserIdFromToken(token);
      if (userId) return `user:${userId}`;
    }
  }

  const ip = getClientIp(request);
  return `ip:${ip}`;
}

/**
 * Comprehensive rate limiting that can be applied to any API route.
 * Returns a 429/503 Response when limited, or null to allow the request through.
 */
export async function applyRateLimit(
  request: Request,
  customType?: RateLimitType,
  customConfig?: { window?: number; maxRequests?: number; keyPrefix?: string },
): Promise<Response | null> {
  try {
    const rateLimitKey = await getRateLimitKey(request);
    const securityIp = getSecurityIp(request);
    const pathname = new URL(request.url).pathname;

    const limitType = customType || determineRateLimitType(pathname);
    const baseConfig = getRateLimitConfig(limitType);
    const config = customConfig || {
      window: baseConfig.window,
      maxRequests: baseConfig.maxRequests,
      keyPrefix: baseConfig.keyPrefix,
    };

    systemLogger.info(
      "Rate limit check initiated",
      { service: "rate-limiter", operation: "applyRateLimit" },
      {
        rateLimitKey,
        securityIp: securityIp.ip,
        securitySource: securityIp.source,
        isLocalhost: securityIp.isLocalhost,
        pathname,
        limitType,
        config,
        method: request.method,
      },
    );

    const allowed = await checkRateLimit(rateLimitKey, {
      window: config.window,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix,
    });

    if (!allowed) {
      const shouldAlert = shouldAlertOnExceed(limitType);
      const logData = {
        rateLimitKey,
        securityIp: securityIp.ip,
        securitySource: securityIp.source,
        isLocalhost: securityIp.isLocalhost,
        pathname,
        limitType,
        config: {
          window: config.window,
          maxRequests: config.maxRequests,
          tps: baseConfig.tps,
        },
        description: baseConfig.description,
      };

      systemLogger.rateLimit(
        shouldAlert ? "Rate limit exceeded (ALERT)" : "Rate limit exceeded",
        "applyRateLimit",
        logData,
      );

      return jsonResponse(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please wait before trying again.",
          retryAfter: config.window,
        },
        429,
        {
          "X-RateLimit-Limit": (config.maxRequests ?? 30).toString(),
          "X-RateLimit-Window": (config.window ?? 60).toString(),
          "X-RateLimit-Type": limitType,
          "Retry-After": (config.window ?? 60).toString(),
        },
      );
    }

    return null;
  } catch (error) {
    debugLog.error(
      "Rate limit check failed",
      { service: "rate-limiter", operation: "applyRateLimit" },
      error,
    );

    // Fail secure — block requests when rate limiting is unavailable.
    return jsonResponse(
      {
        error: "Rate limit service unavailable",
        message: "Service temporarily unavailable. Please try again later.",
      },
      503,
      { "Retry-After": "60" },
    );
  }
}

/**
 * Enhanced rate limiting that applies both user-based and IP-based limits.
 */
export async function applyUserBasedRateLimit(
  request: Request,
  userId?: string,
  limitType?: RateLimitType,
): Promise<Response | null> {
  const ip = getClientIp(request);
  const pathname = new URL(request.url).pathname;
  const rateLimitType = limitType || determineRateLimitType(pathname);
  const config = RATE_LIMIT_CONFIGS[rateLimitType];

  try {
    if (!userId) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        userId = (await extractUserIdFromToken(token)) || undefined;
      }
    }

    if (userId) {
      const userConfig = {
        ...config,
        keyPrefix: `user_${config.keyPrefix}`,
        maxRequests: Math.floor(config.maxRequests * 1.5),
      };

      const userAllowed = await checkRateLimit(userId, userConfig);
      if (!userAllowed) {
        debugLog.warn(
          "User rate limit exceeded",
          { service: "rate-limiter", operation: "applyUserBasedRateLimit" },
          { userId, ip, pathname, limitType: rateLimitType },
        );

        return jsonResponse(
          {
            error: "User rate limit exceeded",
            message:
              "You have made too many requests. Please wait before trying again.",
            retryAfter: userConfig.window,
          },
          429,
          {
            "X-RateLimit-Limit": (userConfig.maxRequests ?? 45).toString(),
            "X-RateLimit-Window": (userConfig.window ?? 60).toString(),
            "X-RateLimit-Type": `user_${rateLimitType}`,
            "Retry-After": (userConfig.window ?? 60).toString(),
          },
        );
      }
    }

    return applyRateLimit(request, rateLimitType);
  } catch (error) {
    debugLog.error(
      "User-based rate limit check failed",
      { service: "rate-limiter", operation: "applyUserBasedRateLimit" },
      error,
    );

    return applyRateLimit(request, rateLimitType);
  }
}

/**
 * Rate limit headers for successful requests.
 */
export function getRateLimitHeaders(
  limitType: RateLimitType,
  remaining?: number,
): Record<string, string> {
  const config = getRateLimitConfig(limitType);

  return {
    "X-RateLimit-Limit": config.maxRequests.toString(),
    "X-RateLimit-Window": config.window.toString(),
    "X-RateLimit-Type": limitType,
    "X-RateLimit-TPS": config.tps.toFixed(2),
    ...(remaining !== undefined && {
      "X-RateLimit-Remaining": remaining.toString(),
    }),
  };
}
