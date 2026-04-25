import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import { adminAuth } from "../services/firebase/admin";
import { authService } from "../domain/singletons";
import { validateCSRFToken } from "../services/csrf/csrf-protection";
import { checkRateLimit } from "../services/rate-limit/rate-limit-redis";
import { getRateLimitConfig } from "../constants/rate-limit.config";
import { systemLogger } from "../utils/system/system-logger";
import { IS_DEVELOPMENT } from "../utils/config/envUtil";
import type { AuthResult, HonoEnv } from "../types/hono.types";

export type {
  AuthResult,
  AdminAuthResult,
  AuthContext,
  Variables,
  HonoEnv,
} from "../types/hono.types";

export type RateLimitType =
  | "public"
  | "customer"
  | "admin"
  | "health"
  | "payment"
  | "auth";

export interface ProtectionOptions {
  skipRateLimit?: boolean;
  skipCSRF?: boolean;
  rateLimitType?: RateLimitType;
  requireAuth?: "user" | "admin" | false;
  bodySchema?: z.ZodSchema<unknown>;
  querySchema?: z.ZodSchema<unknown>;
}

// ─── Auth Middleware ────────────────────────────────────────────────────────────

/**
 * Firebase auth middleware for Hono.
 * Verifies the Bearer token and attaches the user to the context.
 */
export function authMiddleware(
  level: "user" | "admin" = "user",
): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        401,
      );
    }

    try {
      const token = authHeader.substring(7);
      const decodedToken = await adminAuth.verifyIdToken(token, true);

      const email = decodedToken.email;
      if (!email) {
        return c.json(
          { error: "Firebase token missing email", code: "INVALID_TOKEN" },
          401,
        );
      }

      const name = decodedToken.name || email.split("@")[0] || "User";

      const hasAdminClaim = decodedToken["role"] === "admin";

      const session = await authService.establishSessionUser({
        firebaseUid: decodedToken.uid,
        email,
        name,
        level,
        hasAdminClaim,
      });

      if (!session.ok) {
        return c.json(
          { error: "Admin access required", code: "ADMIN_REQUIRED" },
          403,
        );
      }

      const user = session.user;

      const authResult: AuthResult = {
        user: { id: user.id, email: user.email, role: user.role },
        firebaseUser: {
          uid: decodedToken.uid,
          email: decodedToken.email || user.email,
          stripeRole: (decodedToken as Record<string, unknown>).stripeRole as
            | string
            | undefined,
        },
      };

      c.set("auth", authResult);
      await next();
    } catch (error) {
      systemLogger.auth("error", "Auth middleware error", "authMiddleware", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        { error: "Invalid or expired token", code: "INVALID_TOKEN" },
        401,
      );
    }
  };
}

// ─── CSRF Middleware ────────────────────────────────────────────────────────────

/**
 * CSRF protection middleware for mutation operations.
 * Skips GET requests and the CSRF token endpoint itself.
 */
export function csrfMiddleware(): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    if (c.req.method === "GET") {
      await next();
      return;
    }

    if (c.req.path.endsWith("/csrf")) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        {
          error: "Authentication required for CSRF validation",
          code: "AUTH_REQUIRED",
        },
        401,
      );
    }

    try {
      const token = authHeader.substring(7);
      const decodedToken = await adminAuth.verifyIdToken(token, true);
      const firebaseUID = decodedToken.uid;

      const csrfHeader = c.req.header("X-CSRF-Token") || "";
      const isValid = csrfHeader
        ? validateCSRFToken(csrfHeader, firebaseUID)
        : false;

      if (!isValid) {
        return c.json(
          { error: "CSRF token validation failed", code: "CSRF_TOKEN_INVALID" },
          403,
        );
      }

      await next();
    } catch (error) {
      systemLogger.csrf("CSRF validation error", "csrfMiddleware", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        { error: "Invalid authentication token", code: "INVALID_TOKEN" },
        401,
      );
    }
  };
}

// ─── Rate Limiting Middleware ───────────────────────────────────────────────────

/**
 * Rate limiting middleware using Redis.
 */
export function rateLimiter(
  type: RateLimitType = "public",
): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    // Match comprehensive-rate-limiter: avoid Redis IP buckets starving local SPA loads (parallel queries).
    if (IS_DEVELOPMENT) {
      await next();
      return;
    }
    try {
      const config = getRateLimitConfig(type);
      const ip =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
        c.req.header("x-real-ip") ||
        "unknown";

      const result = await checkRateLimit(ip, {
        maxRequests: config.maxRequests,
        window: config.window,
        keyPrefix: config.keyPrefix,
      });

      if (!result) {
        const resetTime = Date.now() + config.window * 1000;
        c.res.headers.set("X-Rate-Limit-Limit", String(config.maxRequests));
        c.res.headers.set("X-Rate-Limit-Remaining", "0");
        c.res.headers.set("X-Rate-Limit-Reset", String(resetTime));
        c.res.headers.set("Retry-After", String(config.window));

        return c.json(
          { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
          429,
        );
      }

      c.set("rateLimitHeaders", {
        "X-Rate-Limit-Limit": String(config.maxRequests),
        "X-Rate-Limit-Remaining": "1",
        "X-Rate-Limit-Reset": String(Date.now() + config.window * 1000),
      });

      await next();

      const headers = c.get("rateLimitHeaders");
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          c.res.headers.set(key, value);
        });
      }
    } catch (error) {
      systemLogger.error("Rate limit error", {
        service: "protection-middleware",
        operation: "rateLimiter",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        {
          error: "Service temporarily unavailable",
          code: "SERVICE_UNAVAILABLE",
        },
        503,
      );
    }
  };
}

// ─── Body Validation Middleware ─────────────────────────────────────────────────

/**
 * Validates request body against a Zod schema.
 */
export function validateBody(
  schema: z.ZodSchema<unknown>,
): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      await next();
      return;
    }

    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return c.json(
          {
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: z.flattenError(result.error),
          },
          422,
        );
      }

      c.set("validatedBody", result.data);
      await next();
    } catch {
      return c.json(
        { error: "Invalid JSON in request body", code: "INVALID_JSON" },
        400,
      );
    }
  };
}

// ─── Query Validation Middleware ─────────────────────────────────────────────────

/**
 * Validates query parameters against a Zod schema.
 */
export function validateQuery(
  schema: z.ZodSchema<unknown>,
): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      return c.json(
        {
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: z.flattenError(result.error),
        },
        422,
      );
    }

    c.set("validatedQuery", result.data);
    await next();
  };
}

// ─── Response Helpers ──────────────────────────────────────────────────────────

/** Standard success response */
export function jsonSuccess(c: Context, data: unknown, status = 200) {
  return c.json(data, status as any);
}

/** Standard error responses */
export function jsonError(
  c: Context,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  const defaultCode =
    status === 400
      ? "BAD_REQUEST"
      : status === 401
        ? "AUTH_REQUIRED"
        : status === 403
          ? "FORBIDDEN"
          : status === 404
            ? "NOT_FOUND"
            : status === 422
              ? "INVALID_INPUT"
              : status === 503
                ? "SERVICE_UNAVAILABLE"
                : "INTERNAL_ERROR";
  const code =
    extra && typeof extra.code === "string" ? extra.code : defaultCode;
  return c.json({ error: message, code, ...extra }, status as any);
}

export function jsonNotFound(c: Context, message = "Not found") {
  return jsonError(c, message, 404);
}

export function jsonBadRequest(
  c: Context,
  message = "Bad request",
  extra?: Record<string, unknown>,
) {
  return jsonError(c, message, 400, extra);
}

export function jsonForbidden(
  c: Context,
  message = "Forbidden",
  extra?: Record<string, unknown>,
) {
  return jsonError(c, message, 403, extra);
}

export function jsonInternalError(
  c: Context,
  message = "Internal server error",
  _error?: unknown,
) {
  return jsonError(c, message, 500, { code: "INTERNAL_ERROR" });
}
