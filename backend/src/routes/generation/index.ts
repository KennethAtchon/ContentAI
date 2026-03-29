import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import {
  generatedContent,
  queueItems,
  reels,
} from "../../infrastructure/database/drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { assertNoChainQueueItem } from "../../lib/queue-chain-guard";
import { generateContent } from "../../services/reels/content-generator";
import {
  generateContentSchema,
  generationHistoryQuerySchema,
  generationIdParamSchema,
  generationListQuerySchema,
  queueGeneratedContentSchema,
} from "../../domain/content/content.schemas";
import { AppError, Errors } from "../../utils/errors/app-error";

const generationRouter = new Hono<HonoEnv>();

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

/**
 * POST /api/generation
 * Generate content from a reel + prompt.
 */
generationRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", generateContentSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { sourceReelId, prompt, outputType } = c.req.valid("json");

    const content = await generateContent({
      reelId: sourceReelId,
      prompt,
      userId: auth.user.id,
      outputType,
    });

    return c.json({ content }, 201);
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
  zValidator("query", generationHistoryQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { page, limit } = c.req.valid("query");
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
  zValidator("query", generationListQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { limit, offset } = c.req.valid("query");

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
  zValidator("param", generationIdParamSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const [item] = await db
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, id),
          eq(generatedContent.userId, auth.user.id),
        ),
      );

    if (!item) {
      throw Errors.notFound("Generated content");
    }

    return c.json({ content: item });
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
  zValidator("param", generationIdParamSchema, validationErrorHook),
  zValidator("json", queueGeneratedContentSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const { scheduledFor, instagramPageId } = c.req.valid("json");

    const [item] = await db
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, id),
          eq(generatedContent.userId, auth.user.id),
        ),
      );

    if (!item) {
      throw Errors.notFound("Generated content");
    }

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    if (scheduledDate && scheduledDate <= new Date()) {
      throw new AppError(
        "scheduledFor must be in the future",
        "INVALID_INPUT",
        400,
      );
    }

    await db
      .update(generatedContent)
      .set({ status: "queued" })
      .where(eq(generatedContent.id, id));

    await assertNoChainQueueItem(
      db,
      id,
      auth.user.id,
      "generation_schedule_endpoint",
    );

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
  },
);

export default generationRouter;
