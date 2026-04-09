import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import * as allSchema from "../../infrastructure/database/drizzle/schema";
import { eq, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { authService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import {
  adminSystemExportNameParamSchema,
  adminSystemExportQuerySchema,
} from "../../domain/admin/admin.schemas";
import { adminService } from "../../domain/singletons";

const systemRouter = new Hono<HonoEnv>();

systemRouter.post(
  "/sync-firebase",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    const results = await authService.syncAllFirebaseUsers();

    const summary = {
      total: results.length,
      successful: results.filter((r: { success?: boolean }) => r.success)
        .length,
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
      await adminService.pingDatabase();
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
  zValidator("param", adminSystemExportNameParamSchema, zodValidationErrorHook),
  zValidator("query", adminSystemExportQuerySchema, zodValidationErrorHook),
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
    const hasIsDeleted = "isDeleted" in table;
    const whereClause =
      !includeDeleted && hasIsDeleted
        ? eq((table as any).isDeleted, false)
        : undefined;

    const { rows, total } = await adminService.queryAdminTablePage({
      table,
      whereClause,
      page,
      limit,
    });

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
