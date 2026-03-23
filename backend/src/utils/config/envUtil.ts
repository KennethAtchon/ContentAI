/**
 * Centralized Environment Variable Access
 *
 * Provides type-safe, validated access to all environment variables.
 * All process.env usage should go through this file for consistency and validation.
 */

function getEnvVar(
  name: string,
  required = true,
  defaultValue?: string,
  value?: string,
): string {
  const envValue = value !== undefined ? value : process.env[name];

  if (required && (!envValue || envValue.length === 0)) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${name} is required but not set.`);
  }
  return envValue || defaultValue || "";
}

function getEnvVarAsBoolean(
  name: string,
  defaultValue = false,
  value?: string,
): boolean {
  const envValue = value !== undefined ? value : process.env[name];
  if (!envValue) return defaultValue;
  return envValue.toLowerCase() === "true" || envValue === "1";
}

function _getEnvVarAsNumber(
  name: string,
  defaultValue?: number,
  value?: string,
): number | undefined {
  const envValue = value !== undefined ? value : process.env[name];
  if (!envValue) return defaultValue;
  const parsed = parseInt(envValue, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvVarAsArray(
  name: string,
  defaultValue: string[] = [],
  value?: string,
): string[] {
  const envValue = value !== undefined ? value : process.env[name];
  if (!envValue) return defaultValue;
  return envValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// ============================================================================
// App & Environment
// ============================================================================
export const APP_ENV = getEnvVar("APP_ENV", false) || "development";
export const IS_PRODUCTION = APP_ENV === "production";
export const IS_DEVELOPMENT = APP_ENV === "development";
export const IS_TEST = APP_ENV === "test";

// ============================================================================
// Database
// ============================================================================
export const DATABASE_URL = getEnvVar("DATABASE_URL", false);
export const ENABLE_DB_HEALTH_CHECKS = getEnvVarAsBoolean(
  "ENABLE_DB_HEALTH_CHECKS",
  false,
);

// ============================================================================
// Redis
// ============================================================================
export const REDIS_URL = getEnvVar("REDIS_URL", false);

// ============================================================================
// Firebase Client (without NEXT_PUBLIC_ prefix for backend)
// ============================================================================
export const FIREBASE_API_KEY = getEnvVar("FIREBASE_API_KEY", true);
export const FIREBASE_AUTH_DOMAIN = getEnvVar("FIREBASE_AUTH_DOMAIN", true);
export const FIREBASE_PROJECT_ID = getEnvVar("FIREBASE_PROJECT_ID", true);
export const FIREBASE_STORAGE_BUCKET = getEnvVar(
  "FIREBASE_STORAGE_BUCKET",
  true,
);
export const FIREBASE_MESSAGING_SENDER_ID = getEnvVar(
  "FIREBASE_MESSAGING_SENDER_ID",
  true,
);
export const FIREBASE_APP_ID = getEnvVar("FIREBASE_APP_ID", true);

// ============================================================================
// Firebase Admin (Server-side only)
// ============================================================================
export const FIREBASE_CLIENT_EMAIL = getEnvVar("FIREBASE_CLIENT_EMAIL", true);
export const FIREBASE_PRIVATE_KEY = getEnvVar("FIREBASE_PRIVATE_KEY", true);

// ============================================================================
// Security
// ============================================================================
export const CSRF_SECRET = getEnvVar("CSRF_SECRET", true);
export const ENCRYPTION_KEY = getEnvVar("ENCRYPTION_KEY", false);
export const ADMIN_SPECIAL_CODE_HASH = getEnvVar(
  "ADMIN_SPECIAL_CODE_HASH",
  false,
);

// ============================================================================
// Stripe
// ============================================================================
export const STRIPE_SECRET_KEY = getEnvVar("STRIPE_SECRET_KEY", false);
export const STRIPE_WEBHOOK_SECRET = getEnvVar("STRIPE_WEBHOOK_SECRET", false);

// ============================================================================
// Email (Resend)
// ============================================================================
export const RESEND_API_KEY = getEnvVar("RESEND_API_KEY", false);
export const RESEND_FROM_EMAIL = getEnvVar(
  "RESEND_FROM_EMAIL",
  false,
  "[FROM_EMAIL]",
);
export const RESEND_REPLY_TO_EMAIL = getEnvVar(
  "RESEND_REPLY_TO_EMAIL",
  false,
  "[REPLY_TO_EMAIL]",
);

// ============================================================================
// Storage (Cloudflare R2)
// ============================================================================
export const R2_ACCOUNT_ID = getEnvVar("R2_ACCOUNT_ID", false);
export const R2_ACCESS_KEY_ID = getEnvVar("R2_ACCESS_KEY_ID", false);
export const R2_SECRET_ACCESS_KEY = getEnvVar("R2_SECRET_ACCESS_KEY", false);
export const R2_BUCKET_NAME = getEnvVar("R2_BUCKET_NAME", false);
export const R2_PUBLIC_URL = getEnvVar("R2_PUBLIC_URL", false);

// ============================================================================
// CORS
// ============================================================================
export const CORS_ALLOWED_ORIGINS = getEnvVarAsArray("CORS_ALLOWED_ORIGINS", [
  "http://localhost:3000",
  "https://example.com",
]);

// ============================================================================
// Observability (Metrics for Grafana Cloud / Prometheus)
// ============================================================================
/** Enable Prometheus metrics collection and /api/metrics endpoint. Default: true in production. */
export const METRICS_ENABLED = getEnvVarAsBoolean(
  "METRICS_ENABLED",
  !IS_DEVELOPMENT,
);
/** Optional bearer token required to access GET /api/metrics. Set in production for Grafana Cloud scraper. */
export const METRICS_SECRET = getEnvVar("METRICS_SECRET", false);

// ============================================================================
// Debug & Logging
// ============================================================================
export const DEBUG_ENABLED = getEnvVarAsBoolean("DEBUG_ENABLED", false);
export const LOG_LEVEL = getEnvVar("LOG_LEVEL", false, "debug") as
  | "debug"
  | "info"
  | "warn"
  | "error";

// ============================================================================
// SEO & Metadata
// ============================================================================
export const BASE_URL = getEnvVar("BASE_URL", false, "http://localhost:3000");

// ============================================================================
// Package Info
// ============================================================================
export const PACKAGE_VERSION = getEnvVar(
  "npm_package_version",
  false,
  "unknown",
);

// ============================================================================
// Deployment platform (for request IP parsing)
// ============================================================================
/** Set by Railway; used to choose rightmost X-Forwarded-For segment (Railway appends client IP). */
export const IS_RAILWAY = !!getEnvVar("RAILWAY_PUBLIC_DOMAIN", false);

// ============================================================================
// AI (Anthropic Claude)
// ============================================================================
export const ANTHROPIC_API_KEY = getEnvVar("ANTHROPIC_API_KEY", false);
export const ANALYSIS_MODEL = getEnvVar(
  "ANALYSIS_MODEL",
  false,
  "claude-haiku-4-5-20251001",
);
export const GENERATION_MODEL = getEnvVar(
  "GENERATION_MODEL",
  false,
  "claude-sonnet-4-6",
);

// ============================================================================
// AI (OpenRouter)
// ============================================================================
export const OPEN_ROUTER_KEY = getEnvVar("OPEN_ROUTER_KEY", false);
export const OPEN_ROUTER_MODEL = getEnvVar(
  "OPEN_ROUTER_MODEL",
  false,
  "openai/gpt-4o-mini",
);

// ============================================================================
// AI (OpenAI)
// ============================================================================
export const OPENAI_API_KEY = getEnvVar("OPENAI_API_KEY", false);
export const OPENAI_MODEL = getEnvVar("OPENAI_MODEL", false, "gpt-4o-mini");

// ============================================================================
// Media Generation (Video / Image)
// ============================================================================
/** Active video generation provider. Options: kling-fal | runway | image-ken-burns */
export const VIDEO_GENERATION_PROVIDER = getEnvVar(
  "VIDEO_GENERATION_PROVIDER",
  false,
  "kling-fal",
);
/** fal.ai API key — used by kling-fal and image-ken-burns providers */
export const FAL_API_KEY = getEnvVar("FAL_API_KEY", false);
/** Runway API key — used by runway provider */
export const RUNWAY_API_KEY = getEnvVar("RUNWAY_API_KEY", false);
/** Runway model: gen3a_turbo (cheaper) or gen3a (higher quality). If set, takes priority over DB config. */
export const RUNWAY_MODEL = getEnvVar("RUNWAY_MODEL", false);
/** Kling model endpoint on fal.ai. If set, takes priority over DB config. */
export const KLING_MODEL = getEnvVar("KLING_MODEL", false);
/** FLUX model on fal.ai for image+ken-burns mode. If set, takes priority over DB config. */
export const FLUX_MODEL = getEnvVar("FLUX_MODEL", false);

// ============================================================================
// Text-to-Speech (ElevenLabs)
// ============================================================================
export const ELEVENLABS_API_KEY = getEnvVar("ELEVENLABS_API_KEY", false);

// ============================================================================
// Reels / Content Platform
// ============================================================================
export const REEL_SOURCE = getEnvVar("REEL_SOURCE", false, "manual");
export const SOCIAL_API_KEY = getEnvVar("SOCIAL_API_KEY", false);
export const INSTAGRAM_API_TOKEN = getEnvVar("INSTAGRAM_API_TOKEN", false);
export const VIRAL_VIEWS_THRESHOLD = parseInt(
  getEnvVar("VIRAL_VIEWS_THRESHOLD", false, "100000"),
  10,
);
/**
 * Development-only: mock outbound integrations (reel scrape, video clip gen, ElevenLabs TTS)
 * using bundled fixtures under `backend/fixtures/media/`. See `docs/plans/dev-mock-external-integrations.md`.
 *
 * When unset, defaults to the legacy scrape flag default so existing `.env` behavior is preserved.
 */
export const DEV_MOCK_EXTERNAL_INTEGRATIONS =
  IS_DEVELOPMENT &&
  getEnvVarAsBoolean(
    "DEV_MOCK_EXTERNAL_INTEGRATIONS",
    getEnvVarAsBoolean("DEV_USE_MOCK_REEL_SCRAPE", IS_DEVELOPMENT),
  );

/** @deprecated Alias of `DEV_MOCK_EXTERNAL_INTEGRATIONS` — use the new name in `.env`. */
export const DEV_USE_MOCK_REEL_SCRAPE = DEV_MOCK_EXTERNAL_INTEGRATIONS;

/**
 * Milliseconds to wait inside mocked `generateVideoClip` before uploading the fixture (simulates provider latency).
 * Only read when `DEV_MOCK_EXTERNAL_INTEGRATIONS` is active. Default `15000`. Set `0` for instant mocks (e.g. tests).
 */
export const DEV_MOCK_VIDEO_CLIP_DELAY_MS = (() => {
  if (!IS_DEVELOPMENT) return 0;
  const raw = process.env.DEV_MOCK_VIDEO_CLIP_DELAY_MS;
  if (raw === undefined || raw === "") return 15_000;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 15_000;
  return Math.max(0, n);
})();

// ============================================================================
// Cron Jobs
// ============================================================================
/** Enable scheduled background jobs (daily scan, etc.). Default: true in production, false in development. */
export const CRON_JOBS_ENABLED = getEnvVarAsBoolean(
  "CRON_JOBS_ENABLED",
  !IS_DEVELOPMENT,
);

// ============================================================================
// Testing & CI
// ============================================================================
export const IS_CI = getEnvVarAsBoolean("CI", false);
export const E2E_BASE_URL = getEnvVar(
  "E2E_BASE_URL",
  false,
  "http://localhost:3000",
);

// ============================================================================
// Firebase Server-side (for Cloud Functions)
// ============================================================================
export const FIREBASE_PROJECT_ID_SERVER = getEnvVar(
  "FIREBASE_PROJECT_ID",
  false,
  FIREBASE_PROJECT_ID, // Fallback to client-side project ID
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get allowed CORS origins based on environment
 */
export function getAllowedCorsOrigins(): string[] {
  if (IS_DEVELOPMENT || APP_ENV === "development") {
    return [
      // Local development (browser access)
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      // Docker network origins (container-to-container)
      "http://frontend:3000",
      "http://backend:3000",
      "http://frontend:3001",
      "http://backend:3001",
      // Allow empty origin for same-origin requests and certain browser behaviors
      "",
      // HTTPS variants
      "https://localhost:3000",
      "https://127.0.0.1:3000",
    ];
  }
  return CORS_ALLOWED_ORIGINS;
}

/**
 * Check if secure cookies should be used (production only)
 */
export function shouldUseSecureCookies(): boolean {
  return IS_PRODUCTION;
}

// Export utility functions for external use
export { getEnvVar, getEnvVarAsBoolean, _getEnvVarAsNumber, getEnvVarAsArray };
