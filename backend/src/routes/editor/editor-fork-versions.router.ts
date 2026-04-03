import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { buildInitialTimeline } from "../../domain/editor/build-initial-timeline";
import {
  editorProjectIdParamSchema,
  editorSnapshotParamSchema,
  forkProjectSchema,
} from "../../domain/editor/editor.schemas";
import { parseStoredEditorTracks } from "../../domain/editor/validate-stored-tracks";
import { Errors } from "../../utils/errors/app-error";
import { contentRepository, editorRepository, captionsService } from "../../domain/singletons";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const forkVersionsRouter = new Hono<HonoEnv>();

forkVersionsRouter.post(
  "/:id/fork",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  zValidator("json", forkProjectSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const auth = c.get("auth");
    const body = c.req.valid("json");

    const root = await editorRepository.findRootProjectByIdForUser(
      id,
      auth.user.id,
    );
    if (!root) throw Errors.notFound("Edit project");

    let aiTimeline: { tracks: unknown; durationMs: number } | null = null;
    if (body.resetToAI && root.generatedContentId) {
      aiTimeline = await buildInitialTimeline(
        contentRepository,
        root.generatedContentId,
        auth.user.id,
        captionsService,
      );
    }

    const validatedRootTracks = parseStoredEditorTracks(root.tracks);

    const { snapshotId } =
      await editorRepository.forkRootToSnapshotAndOptionalAiReset({
        root,
        validatedTracks: validatedRootTracks,
        aiTimeline,
      });

    return c.json({ snapshotId });
  },
);

forkVersionsRouter.get(
  "/:id/versions",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const auth = c.get("auth");

    const versions = await editorRepository.listSnapshotSummariesForRoot(
      id,
      auth.user.id,
    );

    return c.json({ versions });
  },
);

forkVersionsRouter.put(
  "/:id/restore-from/:snapshotId",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorSnapshotParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id, snapshotId } = c.req.valid("param");
    const auth = c.get("auth");

    const [root, snapshot] = await Promise.all([
      editorRepository.findRootProjectByIdForUser(id, auth.user.id),
      editorRepository.findSnapshotChildOfRoot(id, snapshotId, auth.user.id),
    ]);

    if (!root) throw Errors.notFound("Root project");
    if (!snapshot) throw Errors.notFound("Snapshot");

    const validatedRootTracks = parseStoredEditorTracks(root.tracks);
    const validatedSnapshotTracks = parseStoredEditorTracks(snapshot.tracks);

    await editorRepository.restoreRootFromSnapshot({
      root,
      snapshot,
      validatedRootTracks,
      validatedSnapshotTracks,
    });

    return c.json({ ok: true });
  },
);

export default forkVersionsRouter;
