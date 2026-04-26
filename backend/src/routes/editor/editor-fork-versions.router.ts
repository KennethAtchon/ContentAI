import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import {
  editorProjectIdParamSchema,
  editorSnapshotParamSchema,
  forkProjectSchema,
} from "../../domain/editor/editor.schemas";
import { Errors } from "../../utils/errors/app-error";
import { editorRepository, syncService } from "../../domain/singletons";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  applyTracksToDocument,
  computeDocumentHash,
  PERSISTED_DOCUMENT_VERSION,
  type PersistedProjectFile,
} from "../../domain/editor/project-document";
import type { TimelineTrackJson } from "../../domain/editor/timeline/merge-placeholders-with-assets";

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
      aiTimeline = await syncService.deriveTimeline(
        auth.user.id,
        root.generatedContentId,
      );
    }

    const rootDoc = root.projectDocument as PersistedProjectFile | null;

    let aiDoc: PersistedProjectFile | null = null;
    if (aiTimeline) {
      aiDoc = applyTracksToDocument(
        rootDoc,
        root.id,
        root.title,
        aiTimeline.tracks as TimelineTrackJson[],
        aiTimeline.durationMs,
      );
    }

    const { snapshotId } =
      await editorRepository.forkRootToSnapshotAndOptionalAiReset({
        root,
        validatedTracks: rootDoc?.project?.timeline?.tracks ?? [],
        aiTimeline: aiDoc
          ? { tracks: aiDoc.project.timeline.tracks, durationMs: aiDoc.project.timeline.durationMs }
          : null,
      });

    if (aiDoc) {
      await editorRepository.updateProjectDocumentForUser(root.id, auth.user.id, {
        projectDocument: aiDoc,
        projectDocumentVersion: PERSISTED_DOCUMENT_VERSION,
        editorCoreVersion: PERSISTED_DOCUMENT_VERSION,
        documentHash: computeDocumentHash(aiDoc),
        fps: aiDoc.project.settings.frameRate,
        resolution: `${aiDoc.project.settings.width}x${aiDoc.project.settings.height}`,
        durationMs: aiDoc.project.timeline.durationMs,
        expectedSaveRevision: root.saveRevision,
      });
    }

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

    const rootDoc = root.projectDocument as PersistedProjectFile | null;
    const snapshotDoc = snapshot.projectDocument as PersistedProjectFile | null;

    await editorRepository.restoreRootFromSnapshot({
      root,
      snapshot,
      validatedRootTracks: rootDoc?.project?.timeline?.tracks ?? [],
      validatedSnapshotTracks: snapshotDoc?.project?.timeline?.tracks ?? [],
    });

    return c.json({ ok: true });
  },
);

export default forkVersionsRouter;
