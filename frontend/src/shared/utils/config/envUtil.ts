/**
 * Centralized Environment Variable Access (Frontend / Vite)
 *
 * All environment variables for the frontend must be prefixed with VITE_
 * and accessed via import.meta.env — NOT process.env.
 *
 * Server-only variables (DB, Stripe secret, Firebase Admin, etc.) are in
 * backend/src/utils/config/envUtil.ts and must never appear here.
 */

function getEnvVar(name: string, defaultValue = ""): string {
  const value = (import.meta.env as Record<string, string>)[name];
  return value ?? defaultValue;
}

function getEnvVarRequired(name: string): string {
  const value = (import.meta.env as Record<string, string>)[name];
  if (!value) {
    // Avoid importing debugLog here: debug.ts imports envUtil; circular init breaks debugLog in tests.
    // eslint-disable-next-line no-console -- intentional
    console.warn(`[envUtil] Missing required env var: ${name}`);
  }
  return value ?? "";
}

function getEnvVarAsBoolean(name: string, defaultValue = false): boolean {
  const value = (import.meta.env as Record<string, string>)[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

// ============================================================================
// App & Environment
// ============================================================================
export const APP_ENV = getEnvVar("VITE_APP_ENV", "development");
export const IS_PRODUCTION = APP_ENV === "production";
export const IS_DEVELOPMENT = APP_ENV === "development";
export const IS_TEST = APP_ENV === "test";

// ============================================================================
// Firebase Client
// ============================================================================
export const FIREBASE_API_KEY = getEnvVarRequired("VITE_FIREBASE_API_KEY");
export const FIREBASE_AUTH_DOMAIN = getEnvVarRequired(
  "VITE_FIREBASE_AUTH_DOMAIN"
);
export const FIREBASE_PROJECT_ID = getEnvVarRequired(
  "VITE_FIREBASE_PROJECT_ID"
);
export const FIREBASE_STORAGE_BUCKET = getEnvVarRequired(
  "VITE_FIREBASE_STORAGE_BUCKET"
);
export const FIREBASE_MESSAGING_SENDER_ID = getEnvVarRequired(
  "VITE_FIREBASE_MESSAGING_SENDER_ID"
);
export const FIREBASE_APP_ID = getEnvVarRequired("VITE_FIREBASE_APP_ID");
export const FIREBASE_MEASUREMENT_ID = getEnvVar(
  "VITE_FIREBASE_MEASUREMENT_ID"
);

// ============================================================================
// Stripe (public key only — secret key lives in backend)
// ============================================================================
export const STRIPE_PUBLISHABLE_KEY = getEnvVarRequired(
  "VITE_STRIPE_PUBLISHABLE_KEY"
);

// ============================================================================
// API
// ============================================================================
/** Backend API base URL, e.g. http://localhost:3001 (Docker / direct) or http://localhost:3000 (native dev + Vite proxy). */
export const API_URL = getEnvVar("VITE_API_URL", "http://localhost:3001");

// ============================================================================
// SEO & Metadata
// ============================================================================
export const BASE_URL = getEnvVar("VITE_APP_URL", "http://localhost:3000");
export const APP_NAME = getEnvVar("VITE_APP_NAME", "App");

// ============================================================================
// Debug & Logging
// ============================================================================
export const DEBUG_ENABLED = getEnvVarAsBoolean("VITE_DEBUG", false);
export const LOG_LEVEL = getEnvVar("VITE_LOG_LEVEL", "warn") as
  | "debug"
  | "info"
  | "warn"
  | "error";
