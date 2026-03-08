/**
 * Firebase Cloud Logging Integration for Observability
 *
 * ⚠️ CURRENTLY COMMENTED OUT - USING RAILWAY LOGS ⚠️
 *
 * We are currently using Railway's built-in observability for logging:
 * - Railway automatically captures stdout/stderr (console.log, console.error, etc.)
 * - Provides dashboard with CPU, memory, network, disk metrics
 * - Log Explorer with filtering and search capabilities
 * - Can set up monitors/alerts for thresholds
 * - Accessible via Railway dashboard "Observability" tab
 * - Also available via CLI: `railway logs`
 *
 * This Firebase logging implementation is preserved below (commented out) for when we need:
 * - Long-term log retention (beyond Railway's retention)
 * - Complex queries across Firebase services
 * - Integration with Firebase Performance Monitoring
 * - Cross-service log correlation
 *
 * For now, all logging goes through:
 * - SystemLogger (project/shared/utils/system/system-logger.ts)
 * - DebugLogger (project/shared/utils/debug/debug.ts)
 *
 * These log to console, which Railway automatically captures.
 *
 * To enable Firebase logging:
 * 1. Uncomment the implementation below
 * 2. Enable Cloud Logging API in your Firebase project
 * 3. Set FIREBASE_PROJECT_ID environment variable
 * 4. Install: `bun add @google-cloud/logging`
 */

import { systemLogger } from "@/utils/system/system-logger";

// ============================================================================
// FIREBASE LOGGING IMPLEMENTATION (COMMENTED OUT - USING RAILWAY LOGS)
// ============================================================================
/*
import { Logging } from "@google-cloud/logging";
import { FIREBASE_PROJECT_ID } from "@/utils/config/envUtil";
import { systemLogger } from "@/utils/system/system-logger";

// Initialize Firebase Cloud Logging client
let loggingClient: Logging | null = null;

function initializeFirebaseLogging(): Logging | null {
  if (loggingClient) {
    return loggingClient;
  }

  try {
    // Only initialize if Firebase project ID is available
    if (!FIREBASE_PROJECT_ID) {
      systemLogger.warn(
        "Firebase Cloud Logging not initialized: FIREBASE_PROJECT_ID not set",
        {
          service: "observability",
          operation: "initializeFirebaseLogging",
        }
      );
      return null;
    }

    // Initialize with default credentials (uses Firebase Admin SDK credentials)
    loggingClient = new Logging({
      projectId: FIREBASE_PROJECT_ID,
    });

    systemLogger.info("Firebase Cloud Logging initialized", {
      service: "observability",
      operation: "initializeFirebaseLogging",
      projectId: FIREBASE_PROJECT_ID,
    });

    return loggingClient;
  } catch (error) {
    systemLogger.error(
      "Failed to initialize Firebase Cloud Logging",
      {
        service: "observability",
        operation: "initializeFirebaseLogging",
      },
      error
    );
    return null;
  }
}
*/

/**
 * Log levels for Firebase Cloud Logging
 */
export type FirebaseLogLevel =
  | "DEBUG"
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "CRITICAL";

/**
 * Log entry metadata
 */
export interface FirebaseLogMetadata {
  service?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

/**
 * Write a log entry to Firebase Cloud Logging
 * Currently falls back to system logger (which Railway captures)
 */
export async function writeFirebaseLog(
  level: FirebaseLogLevel,
  message: string,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  // ============================================================================
  // FIREBASE IMPLEMENTATION (COMMENTED OUT)
  // ============================================================================
  /*
  const client = initializeFirebaseLogging();
  if (!client) {
    // Fallback to system logger if Firebase logging is not available
    const systemLevel = level.toLowerCase() as "info" | "warn" | "error" | "critical";
    systemLogger[systemLevel](
      message,
      {
        service: metadata.service || "observability",
        operation: metadata.operation || "writeFirebaseLog",
      },
      metadata
    );
    return;
  }

  try {
    const log = client.log("app-logs");
    const entry = log.entry(
      {
        severity: level,
        resource: {
          type: "global",
          labels: {
            project_id: FIREBASE_PROJECT_ID || "unknown",
          },
        },
        labels: {
          service: metadata.service || "unknown",
          operation: metadata.operation || "unknown",
          ...(metadata.userId && { userId: metadata.userId }),
          ...(metadata.requestId && { requestId: metadata.requestId }),
        },
      },
      {
        message,
        ...metadata,
        timestamp: new Date().toISOString(),
      }
    );

    await log.write(entry);
  } catch (error) {
    // Fallback to system logger on error
    systemLogger.error(
      "Failed to write to Firebase Cloud Logging",
      {
        service: "observability",
        operation: "writeFirebaseLog",
      },
      error
    );
  }
  */

  // Current implementation: Fallback to system logger - Railway will capture this
  const systemLevel = level.toLowerCase() as
    | "info"
    | "warn"
    | "error"
    | "critical";
  systemLogger[systemLevel](
    message,
    {
      service: metadata.service || "observability",
      operation: metadata.operation || "writeFirebaseLog",
    },
    metadata,
  );
}

/**
 * Log an info message
 */
export async function logInfo(
  message: string,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  return writeFirebaseLog("INFO", message, metadata);
}

/**
 * Log a warning message
 */
export async function logWarning(
  message: string,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  return writeFirebaseLog("WARNING", message, metadata);
}

/**
 * Log an error message
 */
export async function logError(
  message: string,
  error?: Error | unknown,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  const errorMetadata = {
    ...metadata,
    ...(error instanceof Error && {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
    }),
  };

  return writeFirebaseLog("ERROR", message, errorMetadata);
}

/**
 * Log a critical error message
 */
export async function logCritical(
  message: string,
  error?: Error | unknown,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  const errorMetadata = {
    ...metadata,
    ...(error instanceof Error && {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
    }),
  };

  return writeFirebaseLog("CRITICAL", message, errorMetadata);
}

/**
 * Log API request/response
 */
export async function logApiRequest(
  method: string,
  endpoint: string,
  statusCode: number,
  duration: number,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  const level: FirebaseLogLevel =
    statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARNING" : "INFO";

  return writeFirebaseLog(
    level,
    `API ${method} ${endpoint} - ${statusCode} (${duration}ms)`,
    {
      ...metadata,
      method,
      endpoint,
      statusCode,
      duration,
    },
  );
}

/**
 * Log rate limit violation
 */
export async function logRateLimitViolation(
  rateLimitType: string,
  ip: string,
  endpoint: string,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  return writeFirebaseLog(
    "WARNING",
    `Rate limit exceeded: ${rateLimitType} from ${ip} on ${endpoint}`,
    {
      ...metadata,
      rateLimitType,
      ip,
      endpoint,
      eventType: "rate_limit_violation",
    },
  );
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  eventType: string,
  message: string,
  metadata: FirebaseLogMetadata = {},
): Promise<void> {
  return writeFirebaseLog("WARNING", `Security event: ${message}`, {
    ...metadata,
    eventType: "security",
    securityEventType: eventType,
  });
}

/**
 * Check if Firebase Cloud Logging is available
 * Currently always returns false - using Railway logs
 */
export function isFirebaseLoggingAvailable(): boolean {
  // ============================================================================
  // FIREBASE IMPLEMENTATION (COMMENTED OUT)
  // ============================================================================
  // return initializeFirebaseLogging() !== null;

  return false;
}
