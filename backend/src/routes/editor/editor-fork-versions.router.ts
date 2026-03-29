import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import { editProjects } from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { buildInitialTimeline } from "./services/build-initial-timeline";
import {
  editorProjectIdParamSchema,
  editorSnapshotParamSchema,
  forkProjectSchema,
} from "../../domain/editor/editor.schemas";

const forkVersionsRouter = new Hono<HonoEnv>();
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

// ─── POST /api/editor/:id/fork ───────────────────────────────────────────────

forkVersionsRouter.post(
  "/:id/fork",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  zValidator("json", forkProjectSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const auth = c.get("auth");
      const body = c.req.valid("json");

      const [root] = await db
        .select()
        .from(editProjects)
        .where(
          and(
            eq(editProjects.id, id),
            eq(editProjects.userId, auth.user.id),
            isNull(editProjects.parentProjectId),
          ),
        )
        .limit(1);

      if (!root) return c.json({ error: "Not found" }, 404);

      // Build AI timeline outside the transaction (I/O-heavy, non-DB work)
      let aiTimeline: { tracks: unknown; durationMs: number } | null = null;
      if (body.resetToAI && root.generatedContentId) {
        aiTimeline = await buildInitialTimeline(
          root.generatedContentId,
          auth.user.id,
        );
      }

      // Snapshot + optional root reset must be atomic: a crash between the two
      // would leave a duplicate snapshot without the corresponding root update.
      const [snapshot] = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(editProjects)
          .values({
            userId: root.userId,
            generatedContentId: root.generatedContentId,
            tracks: root.tracks,
            durationMs: root.durationMs,
            fps: root.fps,
            resolution: root.resolution,
            status: "draft",
            title: root.title,
            parentProjectId: root.id,
          })
          .returning({ id: editProjects.id });

        if (aiTimeline) {
          await tx
            .update(editProjects)
            .set({
              tracks: aiTimeline.tracks,
              durationMs: aiTimeline.durationMs,
              status: "draft",
            })
            .where(eq(editProjects.id, root.id));
        }

        return inserted;
      });

      return c.json({ snapshotId: snapshot.id });
    } catch (error) {
      debugLog.error("Failed to fork project", {
        service: "editor-route",
        operation: "forkProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fork project" }, 500);
    }
  },
);

// ─── GET /api/editor/:id/versions ────────────────────────────────────────────

forkVersionsRouter.get(
  "/:id/versions",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const auth = c.get("auth");

      const versions = await db
        .select({
          id: editProjects.id,
          createdAt: editProjects.createdAt,
          status: editProjects.status,
        })
        .from(editProjects)
        .where(
          and(
            eq(editProjects.parentProjectId, id),
            eq(editProjects.userId, auth.user.id),
          ),
        )
        .orderBy(desc(editProjects.createdAt));

      return c.json({ versions });
    } catch (error) {
      debugLog.error("Failed to list versions", {
        service: "editor-route",
        operation: "listVersions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to list versions" }, 500);
    }
  },
);

// ─── PUT /api/editor/:id/restore-from/:snapshotId ────────────────────────────

forkVersionsRouter.put(
  "/:id/restore-from/:snapshotId",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorSnapshotParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id, snapshotId } = c.req.valid("param");
      const auth = c.get("auth");

      const [rootResult, snapshotResult] = await Promise.all([
        db
          .select()
          .from(editProjects)
          .where(
            and(
              eq(editProjects.id, id),
              eq(editProjects.userId, auth.user.id),
              isNull(editProjects.parentProjectId),
            ),
          )
          .limit(1),
        db
          .select()
          .from(editProjects)
          .where(
            and(
              eq(editProjects.id, snapshotId),
              eq(editProjects.userId, auth.user.id),
              eq(editProjects.parentProjectId, id),
            ),
          )
          .limit(1),
      ]);

      const root = rootResult[0];
      const snapshot = snapshotResult[0];

      if (!root) return c.json({ error: "Root project not found" }, 404);
      if (!snapshot) return c.json({ error: "Snapshot not found" }, 404);

      await db.transaction(async (tx) => {
        // Preserve current root state as a new snapshot before overwriting
        await tx.insert(editProjects).values({
          userId: root.userId,
          generatedContentId: root.generatedContentId,
          tracks: root.tracks,
          durationMs: root.durationMs,
          fps: root.fps,
          resolution: root.resolution,
          status: "draft",
          title: root.title,
          parentProjectId: root.id,
        });

        // Overwrite root with the target snapshot's tracks
        await tx
          .update(editProjects)
          .set({
            tracks: snapshot.tracks,
            durationMs: snapshot.durationMs,
            status: "draft",
          })
          .where(eq(editProjects.id, root.id));
      });

      return c.json({ ok: true });
    } catch (error) {
      debugLog.error("Failed to restore from snapshot", {
        service: "editor-route",
        operation: "restoreFromSnapshot",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to restore from snapshot" }, 500);
    }
  },
);

export default forkVersionsRouter;
