/**
 * Application Initialization Module
 * Sets up global error handling, process monitoring, and stability features
 * This should be imported at the very start of the application
 */

import {
  // installGlobalErrorHandlers,
  getErrorMetrics,
} from "@/shared/utils/error-handling/global-error-handler";
import debugLog from "@/shared/utils/debug";
// import getRedisConnection from "@/shared/services/db/redis";
import { systemLogger } from "./system-logger";
import { APP_ENV } from "@/shared/utils/config/envUtil";

// TODO: Implement these when backend services are available
const installGlobalErrorHandlers = () => {
  debugLog.info("Global error handlers not yet implemented", {
    service: "app-initialization",
    operation: "installGlobalErrorHandlers",
  });
};

const getRedisConnection = (): any => {
  debugLog.info("Redis connection not yet implemented", {
    service: "app-initialization",
    operation: "getRedisConnection",
  });
  return null;
};

let isInitialized = false;

// Rate limiting constants (in milliseconds)
const MEMORY_ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const REDIS_ALERT_COOLDOWN = 2 * 60 * 1000; // 2 minutes

// Global rate limiting using global object to prevent multiple instances
function getLastMemoryAlert(): number {
  return (global as any).__lastMemoryAlert || 0;
}

function setLastMemoryAlert(timestamp: number): void {
  (global as any).__lastMemoryAlert = timestamp;
}

function getLastRedisAlert(): number {
  return (global as any).__lastRedisAlert || 0;
}

function setLastRedisAlert(timestamp: number): void {
  (global as any).__lastRedisAlert = timestamp;
}

/**
 * Reset initialization state for testing
 * @internal
 */
export function __resetInitializationForTesting() {
  isInitialized = false;
  (global as any).__lastMemoryAlert = 0;
  (global as any).__lastRedisAlert = 0;
  if ((global as any).__monitoringInterval) {
    clearInterval((global as any).__monitoringInterval);
    delete (global as any).__monitoringInterval;
  }
  // Legacy cleanup for old interval name
  if ((global as any).__memoryCheckInterval) {
    clearInterval((global as any).__memoryCheckInterval);
    delete (global as any).__memoryCheckInterval;
  }
}

/**
 * Initializes all global error handling and process monitoring
 */
export function initializeApp() {
  if (isInitialized) {
    return;
  }

  systemLogger.lifecycle(
    "info",
    "Initializing application with error handling and monitoring",
    "init"
  );

  try {
    // Install global error handlers
    installGlobalErrorHandlers();

    // Set up process monitoring
    setupProcessMonitoring();

    // Set up cleanup handlers
    setupGracefulShutdown();

    isInitialized = true;

    systemLogger.lifecycle(
      "info",
      "Application initialization completed successfully",
      "init"
    );
  } catch (error) {
    systemLogger.lifecycle(
      "critical",
      "Failed to initialize application",
      "init",
      error
    );

    // If we can't set up error handling, this is critical
    process.exit(1);
  }
}

/**
 * Gets Redis health and metrics
 */
async function getRedisHealth() {
  try {
    const redis = getRedisConnection();

    // Test connection with a simple ping
    if (!redis) {
      return {
        status: "error",
        error: "Redis connection not available",
        metrics: {},
      };
    }

    const pingStart = Date.now();
    await redis.ping();
    const pingTime = Date.now() - pingStart;

    // Get Redis info
    const info = await redis.info();
    const memorySection = info
      .split("\r\n")
      .filter(
        (line: string) =>
          line.startsWith("used_memory:") ||
          line.startsWith("used_memory_human:") ||
          line.startsWith("used_memory_rss:") ||
          line.startsWith("connected_clients:") ||
          line.startsWith("blocked_clients:") ||
          line.startsWith("keyspace_hits:") ||
          line.startsWith("keyspace_misses:")
      );

    const metrics: any = {};
    memorySection.forEach((line: string) => {
      const [key, value] = line.split(":");
      if (key && value) {
        metrics[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });

    return {
      status: "connected",
      pingTime,
      metrics,
    };
  } catch (error) {
    systemLogger.redis(
      "error",
      "Redis health check failed",
      "health-check",
      error
    );

    return {
      status: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sets up process monitoring and health checks
 */
function setupProcessMonitoring() {
  // Prevent multiple monitoring intervals
  if ((global as any).__monitoringInterval) {
    debugLog.warn("Monitoring interval already exists, skipping setup", {
      service: "app-monitoring",
      operation: "setup",
    });
    return;
  }

  // Monitor memory usage and Redis health
  const monitoringInterval = setInterval(async () => {
    // Memory monitoring
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    // Alert on high memory usage (over 1GB heap or 2GB RSS) - with global rate limiting
    if (heapUsedMB > 1024 || rssMB > 2048) {
      const now = Date.now();
      const lastAlert = getLastMemoryAlert();
      if (now - lastAlert > MEMORY_ALERT_COOLDOWN) {
        systemLogger.memory("High memory usage detected", "check", {
          heapUsedMB,
          heapTotalMB,
          rssMB,
          external: Math.round(memUsage.external / 1024 / 1024),
          alertCooldownMinutes: MEMORY_ALERT_COOLDOWN / (60 * 1000),
        });
        setLastMemoryAlert(now);
      }
    }

    // Redis monitoring - with global rate limiting
    const redisHealth = await getRedisHealth();
    if (redisHealth.status === "disconnected") {
      const now = Date.now();
      const lastAlert = getLastRedisAlert();
      if (now - lastAlert > REDIS_ALERT_COOLDOWN) {
        systemLogger.redis(
          "warn",
          "Redis connection issues detected",
          "health-check",
          redisHealth
        );
        setLastRedisAlert(now);
      }
    } else if (redisHealth.pingTime && redisHealth.pingTime > 100) {
      const now = Date.now();
      const lastAlert = getLastRedisAlert();
      if (now - lastAlert > REDIS_ALERT_COOLDOWN) {
        systemLogger.redis(
          "warn",
          "High Redis latency detected",
          "latency-check",
          {
            pingTime: redisHealth.pingTime,
            status: redisHealth.status,
            alertCooldownMinutes: REDIS_ALERT_COOLDOWN / (60 * 1000),
          }
        );
        setLastRedisAlert(now);
      }
    }

    // Redis memory alerts - with global rate limiting
    if (redisHealth.metrics && redisHealth.metrics.used_memory) {
      const redisMemoryMB = Math.round(
        redisHealth.metrics.used_memory / 1024 / 1024
      );
      if (redisMemoryMB > 512) {
        // Alert if Redis using more than 512MB
        const now = Date.now();
        const lastAlert = getLastRedisAlert();
        if (now - lastAlert > REDIS_ALERT_COOLDOWN) {
          systemLogger.redis(
            "warn",
            "High Redis memory usage detected",
            "memory-check",
            {
              usedMemoryMB: redisMemoryMB,
              connectedClients: redisHealth.metrics.connected_clients,
              keyspaceHits: redisHealth.metrics.keyspace_hits,
              keyspaceMisses: redisHealth.metrics.keyspace_misses,
              alertCooldownMinutes: REDIS_ALERT_COOLDOWN / (60 * 1000),
            }
          );
          setLastRedisAlert(now);
        }
      }
    }

    // Log error metrics periodically
    const errorMetrics = getErrorMetrics();
    if (errorMetrics.totalErrors > 0) {
      systemLogger.error(
        "Error metrics update",
        {
          service: "app-monitoring",
          operation: "error-metrics",
        },
        errorMetrics
      );
    }
  }, 60000); // Check every minute

  // Store interval ID for cleanup
  (global as any).__monitoringInterval = monitoringInterval;

  systemLogger.lifecycle(
    "info",
    "Process and Redis monitoring enabled",
    "setup"
  );
}

/**
 * Sets up graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const gracefulShutdown = (signal: string) => {
    systemLogger.lifecycle(
      "info",
      `${signal} received, initiating graceful shutdown`,
      "graceful-shutdown"
    );

    // Clear monitoring intervals
    if ((global as any).__monitoringInterval) {
      clearInterval((global as any).__monitoringInterval);
    }
    // Legacy cleanup for old interval name
    if ((global as any).__memoryCheckInterval) {
      clearInterval((global as any).__memoryCheckInterval);
    }

    // Give time for cleanup
    setTimeout(() => {
      systemLogger.lifecycle(
        "info",
        "Graceful shutdown completed",
        "graceful-shutdown"
      );
      process.exit(0);
    }, 3000);
  };

  // Handle various shutdown signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle nodemon restarts in development
  process.once("SIGUSR2", () => {
    systemLogger.lifecycle(
      "info",
      "SIGUSR2 received (nodemon restart)",
      "nodemon-restart"
    );
    process.kill(process.pid, "SIGUSR2");
  });
}

/**
 * Basic health check function (synchronous)
 */
export function getApplicationHealth() {
  const memUsage = process.memoryUsage();
  const errorMetrics = getErrorMetrics();
  const uptime = process.uptime();

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      human: formatUptime(uptime),
    },
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    errorMetrics,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Comprehensive health check function with Redis (asynchronous)
 */
export async function getApplicationHealthDetailed() {
  const basicHealth = getApplicationHealth();
  const redisHealth = await getRedisHealth();

  return {
    ...basicHealth,
    redis: {
      status: redisHealth.status,
      pingTime: redisHealth.pingTime,
      memoryUsed: redisHealth.metrics?.used_memory
        ? Math.round(redisHealth.metrics.used_memory / 1024 / 1024)
        : null,
      connectedClients: redisHealth.metrics?.connected_clients || null,
      keyspaceHits: redisHealth.metrics?.keyspace_hits || null,
      keyspaceMisses: redisHealth.metrics?.keyspace_misses || null,
      error: redisHealth.error || null,
    },
  };
}

/**
 * Formats uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Force initialization in production environments
 */
if (APP_ENV === "production") {
  initializeApp();
}
