import type { MiddlewareHandler } from "hono";
import { getEnvVar } from "../utils/config/envUtil";

/**
 * Security headers middleware — equivalent to Next.js middleware.ts applySecurityHeaders
 *
 * Now runs as a full Hono middleware (no edge runtime limitations).
 * Applies CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.
 */
export function secureHeaders(): MiddlewareHandler {
  const IS_PRODUCTION =
    getEnvVar("APP_ENV", false) === "production" ||
    getEnvVar("NODE_ENV", false) === "production";

  return async (c, next) => {
    await next();

    // Cross-Origin-Opener-Policy
    c.res.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

    // Clickjacking protection
    c.res.headers.set("X-Frame-Options", "DENY");

    // MIME-type sniffing protection
    c.res.headers.set("X-Content-Type-Options", "nosniff");

    // Referrer policy
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // HSTS (production only)
    if (IS_PRODUCTION) {
      c.res.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    // Permissions policy
    const permissionsPolicy = [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "payment=(self)",
      "usb=()",
      "serial=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
      "fullscreen=(self)",
    ].join(", ");
    c.res.headers.set("Permissions-Policy", permissionsPolicy);

    // Legacy XSS filter
    c.res.headers.set("X-XSS-Protection", "1; mode=block");

    // DNS prefetch control
    c.res.headers.set("X-DNS-Prefetch-Control", "off");

    // Adobe cross-domain policies
    c.res.headers.set("X-Permitted-Cross-Domain-Policies", "none");

    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.stripe.com wss://*.firebaseio.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    c.res.headers.set("Content-Security-Policy", csp);

    // API-specific: no-cache headers
    if (c.req.path.startsWith("/api/")) {
      c.res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      c.res.headers.set("Pragma", "no-cache");
      c.res.headers.set("Expires", "0");
    }
  };
}
