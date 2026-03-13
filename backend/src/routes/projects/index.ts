import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import { projects } from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";

const app = new Hono<HonoEnv>();

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
  try {
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
  } catch (error) {
    debugLog.error("Failed to fetch user projects", {
      service: "projects-route",
      operation: "getProjects",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch projects" }, 500);
  }
});

// POST /api/projects - Create new project
app.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createProjectSchema),
  async (c) => {
    try {
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
    } catch (error) {
      debugLog.error("Failed to create project", {
        service: "projects-route",
        operation: "createProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create project" }, 500);
    }
  },
);

// GET /api/projects/:id - Get single project
app.get("/:id", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");
    const projectId = c.req.param("id");

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
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json({ project });
  } catch (error) {
    debugLog.error("Failed to fetch project", {
      service: "projects-route",
      operation: "getProject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch project" }, 500);
  }
});

// PUT /api/projects/:id - Update project
app.put(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", updateProjectSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const projectId = c.req.param("id");
      const updates = c.req.valid("json");

      const [updatedProject] = await db
        .update(projects)
        .set(updates)
        .where(
          and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)),
        )
        .returning();

      if (!updatedProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      return c.json({ project: updatedProject });
    } catch (error) {
      debugLog.error("Failed to update project", {
        service: "projects-route",
        operation: "updateProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update project" }, 500);
    }
  },
);

// DELETE /api/projects/:id - Delete project
app.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const projectId = c.req.param("id");

      const [deletedProject] = await db
        .delete(projects)
        .where(
          and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)),
        )
        .returning();

      if (!deletedProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      return c.json({ message: "Project deleted successfully" });
    } catch (error) {
      debugLog.error("Failed to delete project", {
        service: "projects-route",
        operation: "deleteProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete project" }, 500);
    }
  },
);

export default app;
