import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { systemConfigService } from "../../services/config/system-config.service";
import { debugLog } from "../../utils/debug/debug";

const configAdminRouter = new Hono<HonoEnv>();

// ─── GET /api/admin/config ────────────────────────────────────────────────────

configAdminRouter.get(
  "/config",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const rows = await systemConfigService.getAll();
      return c.json({ config: rows });
    } catch (error) {
      debugLog.error("Failed to fetch system config", {
        service: "admin-config",
        operation: "getAll",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to fetch system config" }, 500);
    }
  },
);

// ─── GET /api/admin/config/:category ─────────────────────────────────────────

configAdminRouter.get(
  "/config/:category",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const category = c.req.param("category");
      const rows = await systemConfigService.getCategoryPublic(category);
      return c.json(rows);
    } catch (error) {
      debugLog.error("Failed to fetch config category", {
        service: "admin-config",
        operation: "getCategory",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to fetch config category" }, 500);
    }
  },
);

// ─── PUT /api/admin/config/:category/:key ─────────────────────────────────────

const updateSchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
});

configAdminRouter.put(
  "/config/:category/:key",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const category = c.req.param("category");
      const key = c.req.param("key");
      const body = await c.req.json();
      const parsed = updateSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      const auth = c.get("auth");
      await systemConfigService.set(
        category,
        key,
        parsed.data.value,
        auth.user.email,
      );

      return c.json({ success: true });
    } catch (error) {
      debugLog.error("Failed to update config", {
        service: "admin-config",
        operation: "update",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to update config" }, 500);
    }
  },
);

// ─── POST /api/admin/config/cache/invalidate ──────────────────────────────────

configAdminRouter.post(
  "/config/cache/invalidate",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const category = (body as Record<string, string>).category ?? "all";
      await systemConfigService.invalidateCache(category);
      return c.json({ success: true, invalidated: category });
    } catch (error) {
      debugLog.error("Failed to invalidate config cache", {
        service: "admin-config",
        operation: "invalidateCache",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to invalidate cache" }, 500);
    }
  },
);

export default configAdminRouter;
