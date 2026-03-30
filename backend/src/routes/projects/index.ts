import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { projectsService } from "../../domain/singletons";
import { uuidParam } from "../../validation/shared.schemas";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../../domain/projects/projects.schemas";

const app = new Hono<HonoEnv>();

// GET /api/projects - List user projects
app.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  const auth = c.get("auth");
  const result = await projectsService.listProjects(auth.user.id);
  return c.json(result);
});

// POST /api/projects - Create new project
app.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createProjectSchema),
  async (c) => {
    const auth = c.get("auth");
    const { name, description } = c.req.valid("json");

    const result = await projectsService.createProject(auth.user.id, {
      name,
      description,
    });

    return c.json(result, 201);
  },
);

// GET /api/projects/:id - Get single project
app.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", uuidParam, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: projectId } = c.req.valid("param");

    const result = await projectsService.getProject(auth.user.id, projectId);
    return c.json(result);
  },
);

// PUT /api/projects/:id - Update project
app.put(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, zodValidationErrorHook),
  zValidator("json", updateProjectSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id: projectId } = c.req.valid("param");
    const updates = c.req.valid("json");

    const result = await projectsService.updateProject(
      auth.user.id,
      projectId,
      updates,
    );

    return c.json(result);
  },
);

// DELETE /api/projects/:id - Delete project
app.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: projectId } = c.req.valid("param");

    const result = await projectsService.deleteProject(auth.user.id, projectId);
    return c.json(result);
  },
);

export default app;
