import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { editorService } from "../../domain/singletons";
import { AppError } from "../../utils/errors/app-error";
import { patchProjectSchema, createProjectSchema } from "./schemas";
import { editorProjectIdParamSchema } from "../../domain/editor/editor.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const projectsRouter = new Hono<HonoEnv>();

projectsRouter.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  const auth = c.get("auth");
  const projects = await editorService.listProjectsForUser(auth.user.id);
  return c.json({ projects });
});

projectsRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createProjectSchema),
  async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");
    const { project } = await editorService.createEditorProject(
      auth.user.id,
      body,
    );
    return c.json({ project }, 201);
  },
);

projectsRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const body = await editorService.getProjectWithParsedTracks(
      auth.user.id,
      id,
    );
    return c.json(body);
  },
);

projectsRouter.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  zValidator("json", patchProjectSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const parsed = c.req.valid("json");
    const body = await editorService.patchAutosaveProject(
      auth.user.id,
      id,
      parsed,
    );
    return c.json(body);
  },
);

projectsRouter.post(
  "/:id/thumbnail",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const formData = await c.req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      throw new AppError("Missing file field", "INVALID_INPUT", 400);
    }

    const body = await editorService.uploadThumbnailForProject(
      auth.user.id,
      id,
      file,
    );
    return c.json(body);
  },
);

projectsRouter.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    await editorService.deleteProjectForUser(auth.user.id, id);
    return c.body(null, 204);
  },
);

projectsRouter.post(
  "/:id/sync-assets",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const result = await editorService.syncNewAssetsIntoProject(
      auth.user.id,
      id,
    );
    return c.json(result);
  },
);

projectsRouter.post(
  "/:id/publish",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const body = await editorService.publishProjectForUser(auth.user.id, id);
    return c.json(body);
  },
);

projectsRouter.post(
  "/:id/new-draft",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const body = await editorService.createNewDraftFromPublished(
      auth.user.id,
      id,
    );
    return c.json(body, 201);
  },
);

export default projectsRouter;
