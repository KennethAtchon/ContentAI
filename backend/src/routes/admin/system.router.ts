import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import { debugLog } from "../../utils/debug/debug";
import * as allSchema from "../../infrastructure/database/drizzle/schema";
import { eq, sql, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { FirebaseUserSync } from "../../services/firebase/sync";

const systemRouter = new Hono<HonoEnv>();

systemRouter.post(
  "/sync-firebase",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const results = await FirebaseUserSync.syncAllUsers();

      const summary = {
        total: results.length,
        successful: results.filter((r: { success?: boolean }) => r.success)
          .length,
        failed: results.filter((r: { success?: boolean }) => !r.success).length,
        results,
      };

      return c.json({ success: true, summary });
    } catch (error) {
      debugLog.error("Failed to sync Firebase", {
        service: "admin-route",
        operation: "syncFirebase",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to sync with Firebase" }, 500);
    }
  },
);

// ─── GET /api/admin/database/health ──────────────────────────────────────────

systemRouter.get(
  "/database/health",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "healthy", database: "connected" });
    } catch (error) {
      debugLog.error("Database health check failed", {
        service: "admin-route",
        operation: "databaseHealthCheck",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        { status: "unhealthy", database: "disconnected", error: String(error) },
        503,
      );
    }
  },
);

// ─── GET /api/admin/schema ─────────────────────────────────────────────────────

systemRouter.get(
  "/schema",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const tables = Object.entries(allSchema)
        .filter(([, val]) => is(val as any, PgTable))
        .map(([exportName, table]) => {
          const tbl = table as PgTable;
          const firstColumn = Object.values(tbl)[0] as { tableName?: string };
          return {
            name: exportName,
            tableName: firstColumn?.tableName || exportName,
            columns: Object.entries(tbl)
              .filter(
                ([, column]) => typeof (column as any)?.dataType === "string",
              )
              .map(([key, column]) => ({
                name: key,
                dataType: (column as any).dataType as string,
                nullable: (column as any).nullable ?? true,
                hasDefault: !!(column as any).hasDefault,
                primaryKey: key === "id",
                unique:
                  (column as any).isUnique || (column as any).unique || false,
              })),
          };
        });

      return c.json({ tables });
    } catch (error) {
      debugLog.error("Failed to fetch schema", {
        service: "admin-route",
        operation: "getSchema",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch schema" }, 500);
    }
  },
);

// ─── GET /api/admin/tables/:exportName ────────────────────────────────────────

systemRouter.get(
  "/tables/:exportName",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const exportName = c.req.param("exportName");
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(c.req.query("limit") || "50")),
    );
    const includeDeleted = c.req.query("includeDeleted") === "true";

    const tableEntry = Object.entries(allSchema).find(
      ([name, val]) => name === exportName && is(val as any, PgTable),
    );

    if (!tableEntry) {
      return c.json({ error: "Table not found" }, 404);
    }

    const table = tableEntry[1] as PgTable;
    const offset = (page - 1) * limit;

    try {
      const hasIsDeleted = "isDeleted" in table;
      const whereClause =
        !includeDeleted && hasIsDeleted
          ? eq((table as any).isDeleted, false)
          : undefined;

      const [rows, countResult] = await Promise.all([
        db.select().from(table).where(whereClause).limit(limit).offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(table)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;

      return c.json({
        data: rows,
        pagination: {
          page,
          totalPages: Math.ceil(total / limit),
          total,
        },
      });
    } catch (error) {
      debugLog.error("Failed to query table", {
        service: "admin-route",
        operation: "getTable",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to query table" }, 500);
    }
  },
);

export default systemRouter;
