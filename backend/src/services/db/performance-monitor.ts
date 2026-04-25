/**
 * Database Performance Monitoring Service
 *
 * Tracks query performance and connection pool health.
 * Delegates to the centralized metrics store in db.ts.
 */

import { systemLogger } from "@/utils/system/system-logger";
import { getQueryStats } from "./db";
import { db } from "./db";
import { sql } from "drizzle-orm";

class DatabasePerformanceMonitor {
  private connectionMetrics: {
    active: number;
    idle: number;
    timestamp: Date;
  }[] = [];

  constructor() {
    this.startConnectionPoolMonitoring();
  }

  private startConnectionPoolMonitoring() {
    setInterval(async () => {
      try {
        await this.checkConnectionPool();
      } catch (err) {
        systemLogger.error(
          "Connection pool monitoring error",
          {
            service: "db-performance-monitor",
            operation: "connection-pool-check",
          },
          err,
        );
      }
    }, 30000);
  }

  private async checkConnectionPool() {
    try {
      const rows = (await db.execute(sql`
        SELECT
          count(*) filter (where state = 'active') as active_connections,
          count(*) filter (where state = 'idle') as idle_connections,
          current_setting('max_connections')::int as max_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `)) as Array<{
        active_connections: string;
        idle_connections: string;
        max_connections: string;
      }>;

      if (rows[0]) {
        const active = Number(rows[0].active_connections) || 0;
        const idle = Number(rows[0].idle_connections) || 0;
        const max = Number(rows[0].max_connections) || 100;
        const util = (active / max) * 100;

        this.connectionMetrics.push({ active, idle, timestamp: new Date() });
        if (this.connectionMetrics.length > 100) this.connectionMetrics.shift();

        if (util > 95) {
          systemLogger.error(
            "CRITICAL: Database connection pool near limit",
            {
              service: "db-performance-monitor",
              operation: "connection-pool-alert",
            },
            { util: `${util.toFixed(1)}%`, active, max },
          );
        } else if (util > 80) {
          systemLogger.warn(
            "Database connection pool usage high",
            {
              service: "db-performance-monitor",
              operation: "connection-pool-alert",
            },
            { util: `${util.toFixed(1)}%`, active, max },
          );
        }
      }
    } catch {
      // pg_stat_activity may not be accessible; skip
    }
  }

  public getQueryStats(minutes = 60) {
    return getQueryStats(minutes);
  }

  public getConnectionStats() {
    const latest = this.connectionMetrics[this.connectionMetrics.length - 1];
    if (!latest)
      return { status: "NO_DATA", message: "No connection metrics available" };
    return {
      status: "OK",
      activeConnections: latest.active,
      idleConnections: latest.idle,
      lastUpdated: latest.timestamp,
    };
  }

  public getHealthCheck() {
    const queryStats = this.getQueryStats(5);
    const connectionStats = this.getConnectionStats();
    const isHealthy =
      queryStats.slowQueries === 0 &&
      queryStats.errorQueries === 0 &&
      connectionStats.status === "OK";
    return {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      queries: queryStats,
      connections: connectionStats,
    };
  }
}

export const dbPerformanceMonitor = new DatabasePerformanceMonitor();
export default dbPerformanceMonitor;
