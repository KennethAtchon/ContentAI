import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  queueItems,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";

const queueRouter = new Hono<HonoEnv>();

/**
 * GET /api/queue
 * List user's queue items, optionally filtered by status.
 */
queueRouter.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");
    const status = c.req.query("status");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const conditions = [eq(queueItems.userId, auth.user.id)];
    if (status) conditions.push(eq(queueItems.status, status));

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(queueItems)
        .where(and(...conditions))
        .orderBy(desc(queueItems.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(queueItems)
        .where(and(...conditions)),
    ]);

    return c.json({ items: rows, total });
  } catch (error) {
    debugLog.error("Failed to fetch queue", {
      service: "queue-route",
      operation: "listQueue",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch queue" }, 500);
  }
});

/**
 * PATCH /api/queue/:id
 * Update schedule time or Instagram page for a queue item.
 */
queueRouter.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const body = await c.req.json();
      const { scheduledFor, instagramPageId } = body as {
        scheduledFor?: string;
        instagramPageId?: string;
      };

      const [item] = await db
        .select()
        .from(queueItems)
        .where(
          and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)),
        );

      if (!item) return c.json({ error: "Queue item not found" }, 404);
      if (item.status === "posted") {
        return c.json({ error: "Cannot update a posted item" }, 400);
      }

      const updateData: Record<string, unknown> = {};
      if (scheduledFor) {
        const date = new Date(scheduledFor);
        if (date <= new Date())
          return c.json({ error: "scheduledFor must be in the future" }, 400);
        updateData.scheduledFor = date;
      }
      if (instagramPageId !== undefined)
        updateData.instagramPageId = instagramPageId;

      const [updated] = await db
        .update(queueItems)
        .set(updateData)
        .where(eq(queueItems.id, id))
        .returning();

      return c.json({ queueItem: updated });
    } catch (error) {
      debugLog.error("Failed to update queue item", {
        service: "queue-route",
        operation: "updateQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update queue item" }, 500);
    }
  },
);

/**
 * DELETE /api/queue/:id
 * Remove a queue item.
 */
queueRouter.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const [item] = await db
        .select()
        .from(queueItems)
        .where(
          and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)),
        );

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      await db.delete(queueItems).where(eq(queueItems.id, id));

      // Reset the generated content status to draft
      if (item.generatedContentId) {
        await db
          .update(generatedContent)
          .set({ status: "draft" })
          .where(eq(generatedContent.id, item.generatedContentId));
      }

      return c.json({ message: "Queue item deleted" });
    } catch (error) {
      debugLog.error("Failed to delete queue item", {
        service: "queue-route",
        operation: "deleteQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete queue item" }, 500);
    }
  },
);

export default queueRouter;
