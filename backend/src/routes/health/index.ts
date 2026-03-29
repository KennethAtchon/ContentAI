import { Hono } from "hono";
import { rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import {
  db,
  getQueryStats,
  ensureConnectionHealth as _ensureConnectionHealth,
} from "../../services/db/db";
import { sql } from "drizzle-orm";
import { authRepository } from "../../domain/singletons";
import getRedisConnection from "../../services/db/redis";
import { getErrorMetrics } from "../../services/observability/metrics";
import { getEnvVar } from "../../utils/config/envUtil";

const health = new Hono<HonoEnv>();

/**
 * GET /api/health
 * Comprehensive health check with DB, Redis, service, and performance checks.
 */
health.get("/", rateLimiter("health"), async (c) => {
  const startTime = Date.now();

  try {
    const healthChecks = await Promise.allSettled([
      checkDatabaseHealth(db),
      checkRedisHealth(getRedisConnection),
      checkServiceHealth(),
      checkDatabasePerformance(getQueryStats),
    ]);

    const [dbResult, redisResult, serviceResult, dbPerfResult] = healthChecks;

    const report = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: getEnvVar("PACKAGE_VERSION", false, "0.1.0"),
      environment: getEnvVar("APP_ENV", false, "development"),
      checks: {
        database: extractResult(dbResult, "database"),
        redis: extractResult(redisResult, "redis"),
        service: extractResult(serviceResult, "service"),
        database_performance: extractResult(
          dbPerfResult,
          "database_performance",
        ),
      },
      response_time_ms: Date.now() - startTime,
    };

    const allHealthy = Object.values(report.checks).every(
      (check) => check.status === "healthy",
    );
    report.status = allHealthy ? "healthy" : "unhealthy";

    return c.json(report, allHealthy ? 200 : 503);
  } catch {
    return c.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        response_time_ms: Date.now() - startTime,
      },
      503,
    );
  }
});

/**
 * GET /api/health/error-monitoring
 * Error monitoring metrics endpoint.
 */
health.get("/error-monitoring", rateLimiter("health"), async (c) => {
  try {
    const metrics = getErrorMetrics();
    return c.json({ metrics });
  } catch {
    return c.json({ error: "Error monitoring unavailable" }, 503);
  }
});

// ─── Helper functions ──────────────────────────────────────────────────────────

interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  message: string;
  response_time_ms: number;
  details?: Record<string, unknown>;
  error?: string;
}

async function checkDatabaseHealth(
  dbInstance: any,
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await Promise.race([
      (async () => {
        await dbInstance.execute(sql`SELECT 1 as health_check`);
        await authRepository.pingUsersTable();
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), 1000),
      ),
    ]);
    return {
      status: "healthy",
      message: "Database connection successful",
      response_time_ms: Date.now() - start,
      details: { connection: "active", query_test: "passed" },
    };
  } catch (error: unknown) {
    return {
      status: "unhealthy",
      message: `Database check failed: ${error instanceof Error ? error.message : "Unknown"}`,
      response_time_ms: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown",
    };
  }
}

async function checkRedisHealth(
  getRedis: () => any,
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    if (!getEnvVar("REDIS_URL", false)) {
      return {
        status: "healthy",
        message: "Redis not configured (optional)",
        response_time_ms: Date.now() - start,
      };
    }
    const redis = getRedis();
    await Promise.race([
      (async () => {
        await redis.ping();
        const key = `health_${Date.now()}`;
        await redis.set(key, "ok", "EX", 5);
        const val = await redis.get(key);
        await redis.del(key);
        if (val !== "ok") throw new Error("Redis read/write failed");
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), 500),
      ),
    ]);
    return {
      status: "healthy",
      message: "Redis connection successful",
      response_time_ms: Date.now() - start,
    };
  } catch (error: unknown) {
    return {
      status: "unhealthy",
      message: `Redis check failed: ${error instanceof Error ? error.message : "Unknown"}`,
      response_time_ms: Date.now() - start,
    };
  }
}

async function checkServiceHealth(): Promise<HealthCheckResult> {
  const mem = process.memoryUsage();
  return {
    status: "healthy",
    message: "Service metrics normal",
    response_time_ms: 0,
    details: {
      uptime: process.uptime(),
      memory_usage_mb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      runtime: "bun",
      platform: process.platform,
    },
  };
}

async function checkDatabasePerformance(
  getQueryStats: (minutes: number) => any,
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const stats = getQueryStats(5);
    const isHealthy = stats.slowQueries === 0 && stats.errorQueries === 0;
    return {
      status: isHealthy ? "healthy" : "unhealthy",
      message: isHealthy
        ? "Database performance is optimal"
        : "Database performance issues detected",
      response_time_ms: Date.now() - start,
      details: {
        queries_last_5_min: stats.totalQueries,
        avg_query_time_ms: stats.averageTime,
        slow_queries: stats.slowQueries,
        error_queries: stats.errorQueries,
      },
    };
  } catch (error: unknown) {
    return {
      status: "unhealthy",
      message: `DB performance check failed: ${error instanceof Error ? error.message : "Unknown"}`,
      response_time_ms: Date.now() - start,
    };
  }
}

function extractResult(
  result: PromiseSettledResult<HealthCheckResult>,
  name: string,
): HealthCheckResult {
  if (result.status === "fulfilled") return result.value;
  return {
    status: "unhealthy",
    message: `${name} check failed`,
    response_time_ms: 0,
    error: result.reason?.message || "Unknown error",
  };
}

export default health;
