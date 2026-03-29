import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import { projects } from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
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

  const userProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, auth.user.id))
    .orderBy(desc(projects.updatedAt));

  return c.json({ projects: userProjects });
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

    const [newProject] = await db
      .insert(projects)
      .values({
        id: crypto.randomUUID(),
        userId: auth.user.id,
        name,
        description,
      })
      .returning();

    return c.json({ project: newProject }, 201);
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

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)))
      .limit(1);

    if (!project) {
      throw Errors.notFound("Project");
    }

    return c.json({ project });
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

    const [updatedProject] = await db
      .update(projects)
      .set(updates)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)),
      )
      .returning();

    if (!updatedProject) {
      throw Errors.notFound("Project");
    }

    return c.json({ project: updatedProject });
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

    const [deletedProject] = await db
      .delete(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)),
      )
      .returning();

    if (!deletedProject) {
      throw Errors.notFound("Project");
    }

    return c.json({ message: "Project deleted successfully" });
  },
);

export default app;
