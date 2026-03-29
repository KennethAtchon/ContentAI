import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { projectsService } from "../../domain/singletons";
import { uuidParam } from "../../validation/shared.schemas";
import { Errors } from "../../utils/errors/app-error";

const app = new Hono<HonoEnv>();
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

// Zod schemas for validation
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

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
  zValidator("param", uuidParam, validationErrorHook),
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
  zValidator("param", uuidParam, validationErrorHook),
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
  zValidator("param", uuidParam, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: projectId } = c.req.valid("param");

    const result = await projectsService.deleteProject(auth.user.id, projectId);
    return c.json(result);
  },
);

export default app;
