import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { uuidParam } from "../../validation/shared.schemas";
import { contentService, chatService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import {
  createSessionSchema,
  listSessionsQuerySchema,
  resolveSessionForContentSchema,
  updateSessionSchema,
} from "./chat.schemas";
import { chatValidationErrorHook } from "./shared-validation";

const sessionsRouter = new Hono<HonoEnv>();

sessionsRouter.get(
  "/sessions",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", listSessionsQuerySchema, chatValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { projectId } = c.req.valid("query");

    const result = await chatService.listSessions(auth.user.id, projectId);

    return c.json(result);
  },
);

sessionsRouter.post(
  "/sessions",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createSessionSchema),
  async (c) => {
    const auth = c.get("auth");
    const { projectId, title } = c.req.valid("json");

    const result = await chatService.createSession(
      auth.user.id,
      projectId,
      title,
    );

    return c.json(result, 201);
  },
);

sessionsRouter.post(
  "/sessions/resolve-for-content",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", resolveSessionForContentSchema),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId } = c.req.valid("json");

    const content = await contentService.getOwnedContentHook(
      generatedContentId,
      auth.user.id,
    );

    if (!content) {
      throw Errors.notFound("Content");
    }

    const result = await chatService.findOrCreateSessionForContent(
      auth.user.id,
      String(generatedContentId),
    );

    return c.json({
      sessionId: result.session.id,
      projectId: result.session.projectId,
      isNew: result.isNew,
    });
  },
);

sessionsRouter.get(
  "/sessions/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", uuidParam, chatValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");

    const result = await chatService.getSessionWithMessages(
      auth.user.id,
      sessionId,
    );

    if (!result) {
      throw Errors.notFound("Session");
    }

    return c.json(result);
  },
);

sessionsRouter.get(
  "/sessions/:id/content",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", uuidParam, chatValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");

    const drafts = await contentService.findChainTipDraftsForSession(
      auth.user.id,
      sessionId,
    );

    return c.json({ drafts });
  },
);

sessionsRouter.delete(
  "/sessions/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, chatValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");

    await chatService.deleteSession(auth.user.id, sessionId);

    return c.json({ message: "Session deleted successfully" });
  },
);

sessionsRouter.put(
  "/sessions/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, chatValidationErrorHook),
  zValidator("json", updateSessionSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");
    const { title } = c.req.valid("json");

    const result = await chatService.updateSession(
      auth.user.id,
      sessionId,
      title,
    );

    return c.json(result);
  },
);

export default sessionsRouter;
