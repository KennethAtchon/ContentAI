/**
 * CORS Constants
 *
 * Single source of truth for CORS header values shared between:
 * - middleware.ts (OPTIONS preflight handling)
 * - shared/middleware/helper.ts (per-route response headers)
 *
 * Change these here and both layers pick up the update automatically.
 */

export const CORS_ALLOW_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS";

export const CORS_ALLOW_HEADERS =
  "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name, X-CSRF-Token";

export const CORS_EXPOSE_HEADERS =
  "X-Total-Count, X-Rate-Limit-Limit, X-Rate-Limit-Remaining, X-Rate-Limit-Reset";
