import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  generatedContent,
  queueItems,
  reels,
} from "../../infrastructure/database/drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { generateContent } from "../../services/reels/content-generator";
import type { OutputType } from "../../services/reels/content-generator";
import { debugLog } from "../../utils/debug/debug";

const generationRouter = new Hono<HonoEnv>();

/**
 * POST /api/generation
 * Generate content from a reel + prompt.
 */
generationRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();

      const {
        sourceReelId,
        prompt,
        outputType = "full_script",
      } = body as {
        sourceReelId: number;
        prompt: string;
        outputType?: OutputType;
      };

      if (!sourceReelId || !prompt?.trim()) {
        return c.json({ error: "sourceReelId and prompt are required" }, 400);
      }

      const content = await generateContent({
        reelId: sourceReelId,
        prompt,
        userId: auth.user.id,
        outputType,
      });

      return c.json({ content }, 201);
    } catch (error) {
      debugLog.error("Failed to generate content", {
        service: "generation-route",
        operation: "generateContent",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to generate content" }, 500);
    }
  },
);

/**
 * GET /api/generation/history
 * List user's generated content history with page-based pagination and reel info.
 */
generationRouter.get(
  "/history",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
      const limit = Math.min(parseInt(c.req.query("limit") ?? "10", 10), 50);
      const offset = (page - 1) * limit;

      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            id: generatedContent.id,
            type: generatedContent.outputType,
            prompt: generatedContent.prompt,
            createdAt: generatedContent.createdAt,
            sourceReelUsername: reels.username,
            sourceReelHook: reels.hook,
          })
          .from(generatedContent)
          .leftJoin(reels, eq(generatedContent.sourceReelId, reels.id))
          .where(eq(generatedContent.userId, auth.user.id))
          .orderBy(desc(generatedContent.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(generatedContent)
          .where(eq(generatedContent.userId, auth.user.id)),
      ]);

      const totalPages = Math.ceil(total / limit);

      return c.json({
        data: rows.map((r) => ({
          id: String(r.id),
          type: r.type,
          sourceReel: {
            username: r.sourceReelUsername ?? "",
            hook: r.sourceReelHook ?? "",
          },
          prompt: r.prompt,
          createdAt: r.createdAt,
          generationTime: 0,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      });
    } catch (error) {
      debugLog.error("Failed to fetch generation history", {
        service: "generation-route",
        operation: "getHistory",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch history" }, 500);
    }
  },
);

/**
 * GET /api/generation
 * List user's generated content history (paginated).
 */
generationRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
      const offset = parseInt(c.req.query("offset") ?? "0", 10);

      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(generatedContent)
          .where(eq(generatedContent.userId, auth.user.id))
          .orderBy(desc(generatedContent.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(generatedContent)
          .where(eq(generatedContent.userId, auth.user.id)),
      ]);

      return c.json({ items: rows, total });
    } catch (error) {
      debugLog.error("Failed to fetch generation history", {
        service: "generation-route",
        operation: "getHistory",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch history" }, 500);
    }
  },
);

/**
 * GET /api/generation/:id
 * Single generated content item.
 */
generationRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const [item] = await db
        .select()
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, id),
            eq(generatedContent.userId, auth.user.id),
          ),
        );

      if (!item) return c.json({ error: "Not found" }, 404);
      return c.json({ content: item });
    } catch (error) {
      debugLog.error("Failed to fetch generated content", {
        service: "generation-route",
        operation: "getContent",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch content" }, 500);
    }
  },
);

/**
 * POST /api/generation/:id/queue
 * Move a generated content item to the queue.
 */
generationRouter.post(
  "/:id/queue",
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
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, id),
            eq(generatedContent.userId, auth.user.id),
          ),
        );

      if (!item) return c.json({ error: "Not found" }, 404);

      // Update status to queued
      await db
        .update(generatedContent)
        .set({ status: "queued" })
        .where(eq(generatedContent.id, id));

      // Create queue item
      const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
      if (scheduledDate && scheduledDate <= new Date()) {
        return c.json({ error: "scheduledFor must be in the future" }, 400);
      }

      const [queueItem] = await db
        .insert(queueItems)
        .values({
          userId: auth.user.id,
          generatedContentId: id,
          scheduledFor: scheduledDate,
          instagramPageId: instagramPageId ?? null,
          status: "scheduled",
        })
        .returning();

      return c.json({ queueItem }, 201);
    } catch (error) {
      debugLog.error("Failed to queue content", {
        service: "generation-route",
        operation: "queueContent",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue content" }, 500);
    }
  },
);

export default generationRouter;
