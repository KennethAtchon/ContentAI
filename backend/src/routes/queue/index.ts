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
import { eq, desc, asc, and, sql, ilike, or } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";

const queueRouter = new Hono<HonoEnv>();

// Valid status transitions: Draft → Ready → Scheduled → Posted (Failed from any)
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["ready", "scheduled"],
  ready: ["draft", "scheduled"],
  scheduled: ["ready", "posted"],
  posted: [],
  failed: ["draft"],
};

/**
 * GET /api/queue
 * List user's queue items with generatedContent preview and optional filters.
 * Query params: status, projectId, search, sort (createdAt|scheduledFor), sortDir (asc|desc), limit, offset
 */
queueRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const status = c.req.query("status");
      const projectId = c.req.query("projectId");
      const search = c.req.query("search")?.trim();
      const sort = c.req.query("sort") ?? "createdAt";
      const sortDir = c.req.query("sortDir") ?? "desc";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
      const offset = parseInt(c.req.query("offset") ?? "0", 10);

      const conditions = [eq(queueItems.userId, auth.user.id)];
      if (status) conditions.push(eq(queueItems.status, status));
      if (projectId) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM chat_message cm
            JOIN chat_session cs ON cm.session_id = cs.id
            WHERE cm.generated_content_id = ${queueItems.generatedContentId}
            AND cs.project_id = ${projectId}
          )`,
        );
      }
      if (search) {
        const term = `%${search}%`;
        conditions.push(
          or(
            ilike(generatedContent.generatedHook, term),
            sql`EXISTS (
              SELECT 1 FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              JOIN project p ON cs.project_id = p.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              AND p.name ILIKE ${term}
            )`,
          ) as ReturnType<typeof eq>,
        );
      }

      const sortColumn =
        sort === "scheduledFor"
          ? queueItems.scheduledFor
          : queueItems.createdAt;
      const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            id: queueItems.id,
            userId: queueItems.userId,
            generatedContentId: queueItems.generatedContentId,
            scheduledFor: queueItems.scheduledFor,
            postedAt: queueItems.postedAt,
            instagramPageId: queueItems.instagramPageId,
            status: queueItems.status,
            errorMessage: queueItems.errorMessage,
            createdAt: queueItems.createdAt,
            // Preview from generatedContent
            generatedHook: generatedContent.generatedHook,
            generatedCaption: generatedContent.generatedCaption,
            thumbnailR2Key: generatedContent.thumbnailR2Key,
            version: generatedContent.version,
            // Project info via chat link (best-effort correlated subquery)
            projectId: sql<string | null>`(
              SELECT cs.project_id FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              LIMIT 1
            )`,
            projectName: sql<string | null>`(
              SELECT p.name FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              JOIN project p ON cs.project_id = p.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              LIMIT 1
            )`,
            sessionId: sql<string | null>`(
              SELECT cm.session_id FROM chat_message cm
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              LIMIT 1
            )`,
          })
          .from(queueItems)
          .leftJoin(
            generatedContent,
            eq(queueItems.generatedContentId, generatedContent.id),
          )
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(queueItems)
          .leftJoin(
            generatedContent,
            eq(queueItems.generatedContentId, generatedContent.id),
          )
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
  },
);

/**
 * POST /api/queue
 * Create a queue item from a generatedContentId.
 */
queueRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();
      const generatedContentId = body?.generatedContentId as number | undefined;

      if (!generatedContentId || typeof generatedContentId !== "number") {
        return c.json({ error: "generatedContentId is required" }, 400);
      }

      // Verify content exists and belongs to user
      const [content] = await db
        .select()
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, generatedContentId),
            eq(generatedContent.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (!content) return c.json({ error: "Content not found" }, 404);

      const [queueItem] = await db
        .insert(queueItems)
        .values({
          userId: auth.user.id,
          generatedContentId,
          status: "draft",
        })
        .returning();

      // Mark content as queued
      await db
        .update(generatedContent)
        .set({ status: "queued" })
        .where(eq(generatedContent.id, generatedContentId));

      return c.json({ queueItem }, 201);
    } catch (error) {
      debugLog.error("Failed to create queue item", {
        service: "queue-route",
        operation: "createQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create queue item" }, 500);
    }
  },
);

/**
 * POST /api/queue/:id/duplicate
 * Clone a queue item as a new draft (version + 1).
 */
queueRouter.post(
  "/:id/duplicate",
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
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)))
        .limit(1);

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      let newGeneratedContentId: number | null = item.generatedContentId;

      if (item.generatedContentId) {
        const [originalContent] = await db
          .select()
          .from(generatedContent)
          .where(eq(generatedContent.id, item.generatedContentId))
          .limit(1);

        if (originalContent) {
          const [newContent] = await db
            .insert(generatedContent)
            .values({
              userId: auth.user.id,
              sourceReelId: originalContent.sourceReelId,
              prompt: originalContent.prompt,
              generatedHook: originalContent.generatedHook,
              generatedCaption: originalContent.generatedCaption,
              generatedScript: originalContent.generatedScript,
              outputType: originalContent.outputType,
              model: originalContent.model,
              status: "draft",
              version: (originalContent.version ?? 1) + 1,
              parentId: originalContent.id,
            })
            .returning();
          newGeneratedContentId = newContent.id;
        }
      }

      const [newItem] = await db
        .insert(queueItems)
        .values({
          userId: auth.user.id,
          generatedContentId: newGeneratedContentId,
          status: "draft",
        })
        .returning();

      return c.json({ queueItem: newItem }, 201);
    } catch (error) {
      debugLog.error("Failed to duplicate queue item", {
        service: "queue-route",
        operation: "duplicateQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to duplicate queue item" }, 500);
    }
  },
);

/**
 * PATCH /api/queue/:id
 * Update status (with transition validation), schedule time, or Instagram page.
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
      const { scheduledFor, instagramPageId, status } = body as {
        scheduledFor?: string;
        instagramPageId?: string;
        status?: string;
      };

      const [item] = await db
        .select()
        .from(queueItems)
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)));

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      const updateData: Record<string, unknown> = {};

      if (status !== undefined) {
        if (item.status === "posted") {
          return c.json({ error: "Cannot update a posted item" }, 400);
        }
        const allowed = VALID_TRANSITIONS[item.status] ?? [];
        if (!allowed.includes(status)) {
          return c.json(
            { error: `Cannot transition from '${item.status}' to '${status}'` },
            400,
          );
        }
        updateData.status = status;
      }

      if (scheduledFor) {
        const date = new Date(scheduledFor);
        if (date <= new Date())
          return c.json({ error: "scheduledFor must be in the future" }, 400);
        updateData.scheduledFor = date;
        // Auto-advance draft/ready to scheduled when a date is set
        if (!status && (item.status === "draft" || item.status === "ready")) {
          updateData.status = "scheduled";
        }
      }

      if (instagramPageId !== undefined)
        updateData.instagramPageId = instagramPageId;

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }

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
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)));

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
