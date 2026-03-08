import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/infrastructure/database/drizzle/schema";
import { DATABASE_URL, APP_ENV } from "@/utils/config/envUtil";
import {
  recordDbQuery,
  recordConnectionPool,
} from "@/services/observability/metrics";
import debugLog from "@/utils/debug/debug";

// ─── Query metrics ────────────────────────────────────────────────────────────

interface QueryMetric {
  model: string;
  operation: string;
  duration: number;
  isError: boolean;
  timestamp: Date;
}

const queryMetrics: QueryMetric[] = [];
const MAX_METRICS = 1000;
const SLOW_QUERY_THRESHOLD = 100; // ms

function pushMetric(metric: QueryMetric) {
  queryMetrics.push(metric);
  if (queryMetrics.length > MAX_METRICS) {
    queryMetrics.splice(0, queryMetrics.length - MAX_METRICS);
  }
  recordDbQuery(
    metric.model,
    metric.operation,
    metric.duration,
    metric.isError ? "error" : "ok",
  );
  if (metric.duration > SLOW_QUERY_THRESHOLD) {
    const level =
      metric.duration > SLOW_QUERY_THRESHOLD * 10 ? "error" : "warn";
    debugLog[level](
      "Slow database query detected",
      { service: "db-client", operation: metric.operation },
      {
        model: metric.model,
        duration: `${metric.duration}ms`,
        threshold: `${SLOW_QUERY_THRESHOLD}ms`,
      },
    );
  }
}

export function getQueryStats(minutes = 60) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const recent = queryMetrics.filter((m) => m.timestamp >= cutoff);
  if (recent.length === 0) {
    return {
      totalQueries: 0,
      averageTime: 0,
      slowQueries: 0,
      errorQueries: 0,
      topSlowQueries: [],
    };
  }
  const totalTime = recent.reduce((s, m) => s + m.duration, 0);
  return {
    totalQueries: recent.length,
    averageTime: Math.round(totalTime / recent.length),
    slowQueries: recent.filter((m) => m.duration > SLOW_QUERY_THRESHOLD).length,
    errorQueries: recent.filter((m) => m.isError).length,
    topSlowQueries: [...recent]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map((m) => ({
        model: m.model,
        operation: m.operation,
        duration: m.duration,
        timestamp: m.timestamp,
      })),
  };
}

export function getConnectionPoolStats() {
  return {
    poolUtilization: 0,
    totalConnections: 0,
    averageActiveConnections: 0,
    averageIdleConnections: 0,
    peakConnections: 0,
  };
}

// ─── Timed query helper ───────────────────────────────────────────────────────

export async function timedQuery<T>(
  model: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    pushMetric({
      model,
      operation,
      duration: Date.now() - start,
      isError: false,
      timestamp: new Date(),
    });
    return result;
  } catch (err) {
    pushMetric({
      model,
      operation,
      duration: Date.now() - start,
      isError: true,
      timestamp: new Date(),
    });
    throw err;
  }
}

// ─── Postgres.js client ───────────────────────────────────────────────────────

const isTest = APP_ENV === "test";

const rawClient = postgres(
  DATABASE_URL || "postgresql://localhost:5432/template",
  {
    max: isTest ? 5 : 20,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {}, // suppress NOTICE messages
  },
);

export const db = drizzle(rawClient, { schema });

// ─── Health / lifecycle ───────────────────────────────────────────────────────

export async function ensureConnectionHealth(): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await rawClient`SELECT 1`;
      return true;
    } catch (err) {
      debugLog.warn(
        "Database connection attempt failed",
        { service: "db-client", operation: "health-check" },
        { attempt, error: err instanceof Error ? err.message : "Unknown" },
      );
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return false;
}

export async function gracefulShutdown(): Promise<void> {
  debugLog.info("Closing database connections", {
    service: "db-client",
    operation: "shutdown",
  });
  try {
    await rawClient.end();
    debugLog.info("Database connections closed", {
      service: "db-client",
      operation: "shutdown",
    });
  } catch (err) {
    debugLog.error(
      "Error closing database",
      { service: "db-client", operation: "shutdown" },
      err,
    );
  }
}

// ─── Graceful shutdown hooks ──────────────────────────────────────────────────

process.on("SIGINT", async () => {
  debugLog.info("SIGINT received, shutting down gracefully");
  await gracefulShutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  debugLog.info("SIGTERM received, shutting down gracefully");
  await gracefulShutdown();
  process.exit(0);
});

// Periodic connection pool recording (not available via postgres.js, so we report zeros)
if (APP_ENV !== "test") {
  setInterval(() => {
    recordConnectionPool(0, 0, 20);
  }, 30000);
}
