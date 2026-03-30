import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { editorProjectIdParamSchema } from "../../domain/editor/editor.schemas";
import { Errors } from "../../utils/errors/app-error";
import { editorRepository } from "../../domain/singletons";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const linkRouter = new Hono<HonoEnv>();

linkRouter.post(
  "/:id/link-content",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const auth = c.get("auth");

    const project = await editorRepository.findByIdAndUserId(id, auth.user.id);
    if (!project) throw Errors.notFound("Edit project");

    if (project.generatedContentId) {
      return c.json({ generatedContentId: project.generatedContentId });
    }

    const linkedContentId =
      await editorRepository.createDraftContentAndLinkBlankProject(
        auth.user.id,
        id,
      );

    return c.json({ generatedContentId: linkedContentId });
  },
);

export default linkRouter;
