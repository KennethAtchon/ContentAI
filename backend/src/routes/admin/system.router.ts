import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
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
import { Errors } from "../../utils/errors/app-error";
import {
  adminSystemExportNameParamSchema,
  adminSystemExportQuerySchema,
} from "../../domain/admin/admin.schemas";

const systemRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

systemRouter.post(
  "/sync-firebase",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    const results = await FirebaseUserSync.syncAllUsers();

    const summary = {
      total: results.length,
      successful: results.filter((r: { success?: boolean }) => r.success).length,
      failed: results.filter((r: { success?: boolean }) => !r.success).length,
      results,
    };

    return c.json({ success: true, summary });
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
  },
);

// ─── GET /api/admin/tables/:exportName ────────────────────────────────────────

systemRouter.get(
  "/tables/:exportName",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("param", adminSystemExportNameParamSchema, validationErrorHook),
  zValidator("query", adminSystemExportQuerySchema, validationErrorHook),
  async (c) => {
    const { exportName } = c.req.valid("param");
    const { page, limit, includeDeleted } = c.req.valid("query");

    const tableEntry = Object.entries(allSchema).find(
      ([name, val]) => name === exportName && is(val as any, PgTable),
    );

    if (!tableEntry) {
      throw Errors.notFound("Table");
    }

    const table = tableEntry[1] as PgTable;
    const offset = (page - 1) * limit;

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
  },
);

export default systemRouter;
