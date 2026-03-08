/**
 * Centralized Rate Limit Configuration with TPS (Transactions Per Second) Calculations
 *
 * This configuration provides a single source of truth for all rate limits in the application.
 * TPS calculations help monitor when something is breaking by providing clear metrics.
 *
 * TPS = maxRequests / window (in seconds)
 *
 * Example: 60 requests per 60 seconds = 1 TPS
 */

export interface RateLimitConfig {
  /** Time window in seconds */
  window: number;
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Redis key prefix for rate limiting */
  keyPrefix: string;
  /** Calculated TPS (Transactions Per Second) */
  tps: number;
  /** Human-readable description */
  description: string;
  /** Whether this limit should trigger alerts when exceeded */
  alertOnExceed: boolean;
}

/**
 * Calculate TPS from window and maxRequests
 */
function calculateTPS(window: number, maxRequests: number): number {
  return maxRequests / window;
}

/**
 * Rate limit configurations for different endpoint types
 *
 * All configurations include TPS calculations for monitoring and alerting.
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits to prevent brute force
  auth: {
    window: 60, // 1 minute
    maxRequests: 5,
    keyPrefix: "auth_rate_limit",
    tps: calculateTPS(60, 5),
    description: "Authentication endpoints (login, signup, password reset)",
    alertOnExceed: true, // Critical security event
  },

  // Payment endpoints - very strict limits to prevent abuse
  payment: {
    window: 3600, // 1 hour
    maxRequests: 30,
    keyPrefix: "payment_rate_limit",
    tps: calculateTPS(3600, 30),
    description: "Payment and checkout endpoints",
    alertOnExceed: true, // Critical business event
  },

  // File upload endpoints - moderate limits to prevent resource exhaustion
  upload: {
    window: 60, // 1 minute
    maxRequests: 25,
    keyPrefix: "upload_rate_limit",
    tps: calculateTPS(60, 25),
    description: "File upload endpoints",
    alertOnExceed: true, // Resource-intensive operations
  },

  // Admin endpoints - moderate limits for administrative operations
  admin: {
    window: 60, // 1 minute
    maxRequests: 30,
    keyPrefix: "admin_rate_limit",
    tps: calculateTPS(60, 30),
    description: "Admin dashboard and management endpoints",
    alertOnExceed: true, // Security-sensitive operations
  },

  // Customer endpoints - standard limits for authenticated users
  customer: {
    window: 60, // 1 minute
    maxRequests: 60,
    keyPrefix: "customer_rate_limit",
    tps: calculateTPS(60, 60),
    description: "Customer profile and account endpoints",
    alertOnExceed: false, // Normal user operations
  },

  // Public endpoints - more generous limits for public API access
  public: {
    window: 60, // 1 minute
    maxRequests: 100,
    keyPrefix: "public_rate_limit",
    tps: calculateTPS(60, 100),
    description: "Public API endpoints (no authentication required)",
    alertOnExceed: true, // Could indicate scraping or DDoS
  },

  // Health/system endpoints - minimal limits for monitoring
  health: {
    window: 60, // 1 minute
    maxRequests: 200,
    keyPrefix: "health_rate_limit",
    tps: calculateTPS(60, 200),
    description: "Health check and system status endpoints",
    alertOnExceed: false, // Monitoring tools may hit these frequently
  },

  // Calculator endpoints - moderate limits for calculator operations
  calculator: {
    window: 60, // 1 minute
    maxRequests: 100,
    keyPrefix: "calculator_rate_limit",
    tps: calculateTPS(60, 100),
    description: "Calculator computation endpoints",
    alertOnExceed: false, // Normal usage pattern
  },

  // Subscription endpoints - moderate limits for subscription management
  subscription: {
    window: 60, // 1 minute
    maxRequests: 20,
    keyPrefix: "subscription_rate_limit",
    tps: calculateTPS(60, 20),
    description: "Subscription management endpoints",
    alertOnExceed: true, // Business-critical operations
  },

  // Contact form endpoints - moderate limits to prevent spam
  contact: {
    window: 300, // 5 minutes
    maxRequests: 5,
    keyPrefix: "contact_rate_limit",
    tps: calculateTPS(300, 5),
    description: "Contact form submission endpoints",
    alertOnExceed: true, // Could indicate spam or abuse
  },

  // Default fallback for unclassified endpoints
  default: {
    window: 60, // 1 minute
    maxRequests: 30,
    keyPrefix: "default_rate_limit",
    tps: calculateTPS(60, 30),
    description: "Default rate limit for unclassified endpoints",
    alertOnExceed: false,
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Get rate limit configuration by type
 */
export function getRateLimitConfig(type: RateLimitType): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[type] || RATE_LIMIT_CONFIGS.default;
}

/**
 * Get all rate limit configurations as an array
 */
export function getAllRateLimitConfigs(): Array<
  RateLimitConfig & { type: RateLimitType }
> {
  return Object.entries(RATE_LIMIT_CONFIGS).map(([type, config]) => ({
    ...config,
    type: type as RateLimitType,
  }));
}

/**
 * Get rate limit configurations that should trigger alerts
 */
export function getAlertableRateLimitConfigs(): Array<
  RateLimitConfig & { type: RateLimitType }
> {
  return getAllRateLimitConfigs().filter((config) => config.alertOnExceed);
}

/**
 * Calculate remaining requests before rate limit is hit
 */
export function calculateRemainingRequests(
  type: RateLimitType,
  currentRequests: number
): number {
  const config = getRateLimitConfig(type);
  return Math.max(0, config.maxRequests - currentRequests);
}

/**
 * Check if a rate limit type should trigger an alert when exceeded
 */
export function shouldAlertOnExceed(type: RateLimitType): boolean {
  const config = getRateLimitConfig(type);
  return config.alertOnExceed;
}

/**
 * Get TPS for a rate limit type
 */
export function getTPS(type: RateLimitType): number {
  const config = getRateLimitConfig(type);
  return config.tps;
}

/**
 * Get human-readable summary of all rate limits
 */
export function getRateLimitSummary(): string {
  const configs = getAllRateLimitConfigs();
  const lines = configs.map((config) => {
    return `${config.type.padEnd(15)} | ${config.maxRequests.toString().padStart(4)} req/${config.window}s | ${config.tps.toFixed(2).padStart(6)} TPS | ${config.alertOnExceed ? "ALERT" : "      "} | ${config.description}`;
  });

  return [
    "Rate Limit Configuration Summary",
    "=".repeat(100),
    "Type".padEnd(15) +
      " | " +
      "Limit".padEnd(15) +
      " | " +
      "TPS".padEnd(8) +
      " | " +
      "Alert".padEnd(8) +
      " | Description",
    "-".repeat(100),
    ...lines,
    "=".repeat(100),
  ].join("\n");
}
