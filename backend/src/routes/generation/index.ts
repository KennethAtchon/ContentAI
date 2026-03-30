import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import {
  generateContentSchema,
  generationHistoryQuerySchema,
  generationIdParamSchema,
  generationListQuerySchema,
  queueGeneratedContentSchema,
} from "../../domain/content/content.schemas";
import { contentService, queueService } from "../../domain/singletons";
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

// POST /api/generation
// Creates a generation job (reel analysis + script/hook generation)
generationRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", generateContentSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { sourceReelId, prompt, outputType } = c.req.valid("json");

    const result = await contentService.generateFromSourceReel({
      userId: auth.user.id,
      reelId: sourceReelId,
      prompt,
      outputType,
    });

    return c.json(result, 201);
  },
);

// GET /api/generation/history
// Returns enriched generation rows with source reel metadata for the UI
generationRouter.get(
  "/history",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", generationHistoryQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { page, limit } = c.req.valid("query");

    const result = await contentService.listGenerationHistory(
      auth.user.id,
      page,
      limit,
    );

    return c.json({
      data: result.rows.map((r) => ({
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
        total: result.total,
        totalPages: result.totalPages,
        hasMore: page < result.totalPages,
      },
    });
  },
);

// GET /api/generation
// List user's generated content history (paginated).
generationRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", generationListQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { limit, offset } = c.req.valid("query");

    const result = await contentService.listGeneratedContent(
      auth.user.id,
      limit,
      offset,
    );

    return c.json({ items: result.rows, total: result.total });
  },
);

// GET /api/generation/:id
// Single generated content item.
generationRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", generationIdParamSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const item = await contentService.findGeneratedContentById(id, auth.user.id);

    if (!item) {
      throw Errors.notFound("Generated content");
    }

    return c.json({ content: item });
  },
);

// POST /api/generation/:id/queue
// Move a generated content item to the queue.
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
    const { scheduledFor } = c.req.valid("json");

    const item = await contentService.findGeneratedContentById(id, auth.user.id);

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

    const { queueItem } = await queueService.createScheduledQueueItem(
      auth.user.id,
      id,
      scheduledDate,
    );

    return c.json({ success: true, queueItem });
  },
);

export default generationRouter;
