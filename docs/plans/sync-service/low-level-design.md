# SyncService - Low Level Design

Implementation plan. Read `high-level-design.md` first while this folder still exists.

**This folder (including `firing-map.md`) is planning material and will be removed later.** The implementation must not depend on it staying in the repo. **All behavior that matters - firing map, constraints, merge rules, wiring - must live in source comments** (and tests), written so a maintainer never needs these markdown files.

---

## In-code documentation (required)

The LLD shows **shapes** of code, not the commentary the shipped tree must carry. Treat verbose, accurate comments as part of the deliverable; they are the long-term documentation.

**`sync.service.ts`**

- **Module- or class-level block (must subsume the firing map):** Spell out, in prose or structured comment, **every** path that triggers sync and **every** important path that does not. State that sync completes **before** the SSE event reaches the client. List invariants: no autosave version bump on `updateProjectForSync`, preservation of the existing video track when a fresh derive has zero video clips, user-sourced clips untouched, content-sourced clips replaced with trim/layout preserved per `assetId`, ancestor chain / `generatedContentId` behavior as implemented, and the fact that chat session draft membership / `activeContentId` are owned elsewhere by the chat tool save path.
- **Public methods:** JSDoc that a future maintainer can trust - purpose, caller context, and ordering guarantees where they matter.
- **Private helpers (especially `mergeTrackSets`):** Explain **why** each rule exists and what breaks if it is violated, not just the mechanics of the loop. Call out edge cases (empty tracks, missing assets, idempotent caption path).

**Wiring and call sites**

- **`send-message.stream.ts`**, **`chat-tools.ts`**, **`editor.service.ts`:** Comments at the callback injection, tool success path, or `deriveTimeline` call that document the full trigger chain end-to-end (who sets `savedContentId`, when the session draft registry is updated, what runs next, what the client observes after). A reader of any one file must not need the deleted docs to understand how sync is reached.

**Bar to clear**

After `docs/plans/sync-service/` is gone, someone can still learn SyncService entirely from the backend source (and tests). Do not reference these plan files from production code as the place to "read more" - paste the substance into comments instead.

---

## What Gets Deleted

| File / Symbol | Delete entirely |
|---|---|
| `backend/src/domain/editor/build-initial-timeline.ts` | Yes |
| `backend/src/domain/editor/merge-new-assets.ts` | Yes |
| `EditorService.syncNewAssetsIntoProject()` | Yes |
| Import of `buildInitialTimeline` in `editor.service.ts` | Yes |
| Import of `mergeNewAssetsIntoProject` in `editor.service.ts` | Yes |
| `mergedAssetIds` column in `editProjects` schema | Yes |
| `updateTracksDurationMerged()` on `IEditorRepository` | Yes |
| `mergedAssetIds` recomputation in `patchAutosaveProject` | Yes |
| `mergedAssetIds` on `EditProject` frontend type | Yes |

**NOT deleted:** `refreshEditorTimeline` on `IEditorRepository` - still used by the video job runner.

---

## Schema Change

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

Remove from `editProjects`:

```typescript
mergedAssetIds: jsonb("merged_asset_ids").$type<string[]>().notNull().default([]),
```

Then run:

```bash
bun run db:reset
```

---

## New File: `SyncService`

**File:** `backend/src/domain/editor/sync/sync.service.ts`

### Types

```typescript
import type { IContentRepository } from "../../content/content.repository";
import type { IEditorRepository } from "../editor.repository";
import type { CaptionsService } from "../captions.service";
import type { TimelineTrackJson } from "../timeline/merge-placeholders-with-assets";
import type { TimelineClipJson } from "../timeline/clip-trim";
import { normalizeMediaClipTrimFields } from "../timeline/clip-trim";
import { buildCaptionClip } from "../timeline/build-caption-clip";
import { debugLog } from "../../../utils/debug/debug";

type ContentAssetRow = {
  id: string;
  role: string | null;
  durationMs: number | null;
  metadata: unknown;
};

type ClipUserAdjustments = {
  trimStartMs: number;
  trimEndMs: number;
  durationMs: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
};
```

### Class

```typescript
export class SyncService {
  constructor(
    private readonly editor: IEditorRepository,
    private readonly content: IContentRepository,
    private readonly captionsService: CaptionsService,
  ) {}

  /**
   * Build a fresh timeline from a content record's assets.
   * Stateless - always produces source:"content" clips from current DB state.
   * Used on initial project creation and as the base for syncLinkedProjects.
   */
  async deriveTimeline(
    userId: string,
    contentId: number,
  ): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }> { ... }

  /**
   * After any text content tool call succeeds, re-sync all editor projects
   * linked to this content or any ancestor in its chain.
   * Must complete before the SSE event fires.
   */
  async syncLinkedProjects(
    userId: string,
    contentId: number,
  ): Promise<void> { ... }
}
```

### `deriveTimeline` body

```typescript
async deriveTimeline(userId, contentId) {
  const assets = await this.content.listAssetsLinkedToGeneratedContent(contentId);
  if (assets.length === 0) return { tracks: this.emptyTracks(), durationMs: 0 };

  const videoAssets = assets
    .filter((a) => a.role === "video_clip")
    .sort((a, b) => this.shotIndex(a.metadata) - this.shotIndex(b.metadata));
  const voiceoverAsset = assets.find((a) => a.role === "voiceover");
  const musicAsset = assets.find((a) => a.role === "background_music");

  const tracks = this.emptyTracks();

  tracks.find((t) => t.type === "video")!.clips = this.buildVideoClips(videoAssets);

  if (voiceoverAsset) {
    tracks.find((t) => t.type === "audio")!.clips = [
      this.buildAudioClip(voiceoverAsset, "voiceover", "Voiceover", 1),
    ];
  }

  if (musicAsset) {
    tracks.find((t) => t.type === "music")!.clips = [
      this.buildAudioClip(musicAsset, "music", "Music", 0.3),
    ];
  }

  if (voiceoverAsset && (voiceoverAsset.durationMs ?? 0) > 0) {
    try {
      const { captionDocId } = await this.captionsService.transcribeAsset(userId, voiceoverAsset.id);
      tracks.find((t) => t.type === "text")!.clips = [
        buildCaptionClip({ captionDocId, voiceoverAsset, voiceoverClipId: null }) as unknown as TimelineClipJson,
      ];
    } catch (err) {
      debugLog.warn("Caption transcription failed during deriveTimeline", {
        service: "sync-service",
        contentId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return { tracks, durationMs: this.computeDuration(tracks) };
}
```

### `syncLinkedProjects` body

```typescript
async syncLinkedProjects(userId, contentId) {
  const chainIds = await this.content.resolveContentAncestorChainIds(contentId, userId);
  const linkedProjects = await this.editor.findProjectsByContentIds(userId, chainIds);
  if (linkedProjects.length === 0) return;

  const { tracks: freshTracks, durationMs } = await this.deriveTimeline(userId, contentId);
  const contentMeta = await this.content.findIdAndHookForUser(contentId, userId);

  for (const project of linkedProjects) {
    const existingTracks = project.tracks as TimelineTrackJson[];
    const mergedTracks = this.mergeTrackSets(freshTracks, existingTracks);

    await this.editor.updateProjectForSync(project.id, userId, {
      tracks: mergedTracks,
      durationMs,
      generatedContentId: contentId,
      generatedHook: contentMeta?.generatedHook ?? null,
      postCaption: contentMeta?.postCaption ?? null,
    });
  }
}
```

### Private helpers

```typescript
private emptyTracks(): TimelineTrackJson[] { ... }
private buildVideoClips(assets: ContentAssetRow[]): TimelineClipJson[] { ... }
private buildAudioClip(asset: ContentAssetRow, idPrefix: string, label: string, volume: number): TimelineClipJson { ... }

/**
 * Merge fresh content-derived tracks with existing project tracks.
 * Rules:
 * 1. User clips (source:"user") always carried forward untouched.
 * 2. Content clips replaced by fresh ones, except adjustments (trims, position,
 *    scale, rotation) are preserved when the same assetId existed before.
 * 3. If fresh video track is empty (new content version, no videos yet),
 *    keep existing video clips unchanged.
 */
private mergeTrackSets(fresh: TimelineTrackJson[], existing: TimelineTrackJson[]): TimelineTrackJson[] { ... }

private shotIndex(metadata: unknown): number { ... }
private computeDuration(tracks: TimelineTrackJson[]): number { ... }
```

---

## `source` Field on Clip Types

**Backend - `backend/src/domain/editor/timeline/clip-trim.ts`:**

```typescript
source?: "content" | "user";
```

**Frontend - `frontend/src/features/editor/types/editor.ts`:**

Add to `MediaClipBase` (covers `VideoClip`, `AudioClip`, `MusicClip`) and `TextClip`:

```typescript
source?: "content" | "user";
```

**Frontend - `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`:**

In `ADD_CLIP` case, set `source: "user"` on the inserted clip:

```typescript
clips: [...t.clips, { ...action.clip, locallyModified: true, source: "user" as const }],
```

Same for `ADD_CLIP_AUTO_PROMOTE` and `PASTE_CLIP`.

---

## New Repository Methods

**File:** `backend/src/domain/editor/editor.repository.ts`

### `findProjectsByContentIds`

Add to `IEditorRepository` interface and `EditorRepository` class:

```typescript
async findProjectsByContentIds(
  userId: string,
  contentIds: number[],
): Promise<{ id: string; tracks: unknown; durationMs: number }[]> { ... }
```

### `updateProjectForSync`

Add to `IEditorRepository` interface and `EditorRepository` class:

```typescript
async updateProjectForSync(
  projectId: string,
  userId: string,
  data: {
    tracks: unknown;
    durationMs: number;
    generatedContentId: number;
    generatedHook: string | null;
    postCaption: string | null;
  },
): Promise<void> { ... }
```

`updateProjectForSync` should not bump any autosave/version field. Sync must stay transparent to editor conflict detection.

---

## Wiring: `ToolContext` Callback

**File:** `backend/src/domain/chat/chat-tools.ts`

```typescript
export interface ToolContext {
  auth: HonoEnv["Variables"]["auth"];
  content: string;
  reelRefs?: number[];
  savedContentId?: number;
  onContentSaved?: (contentId: number) => Promise<void>;
}
```

In `save_content`, `iterate_content`, and `edit_content_field`, after the DB write:

```typescript
context.savedContentId = row.id;
await context.onContentSaved?.(row.id);
return { success: true, contentId: row.id };
```

These tool paths also own the chat-session side effects around drafts. `save_content` and `iterate_content` attach the saved content to the current session and advance `chat_sessions.activeContentId`. `edit_content_field` keeps the same session-owned draft active. SyncService should remain downstream of that save path rather than trying to manage chat session state itself.

**File:** `backend/src/domain/chat/send-message.stream.ts`

```typescript
const toolContext: ToolContext = {
  auth,
  content,
  reelRefs,
  get savedContentId() { return savedContentId || undefined; },
  set savedContentId(value) { savedContentId = value || null; },
  onContentSaved: (contentId) => syncService.syncLinkedProjects(auth.user.id, contentId),
};
```

`syncService` injected via singleton - see below.

---

## Wiring: `EditorService.createEditorProject`

**File:** `backend/src/domain/editor/editor.service.ts`

Replace:

```typescript
import { buildInitialTimeline } from "./build-initial-timeline";
const result = await buildInitialTimeline(this.content, generatedContentId, userId, this.captionsService);
```

With:

```typescript
const result = await this.syncService.deriveTimeline(userId, generatedContentId);
```

Remove `syncNewAssetsIntoProject()` entirely.

---

## Singleton Registration

**File:** `backend/src/domain/singletons.ts`

```typescript
import { SyncService } from "./editor/sync/sync.service";

export const syncService = new SyncService(
  editorRepository,
  contentRepository,
  captionsService,
);
```

---

## Frontend: Session Draft Visibility and Editor Project Refresh

**File:** `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts`

The client no longer relies on a one-shot `invalidateSessionDrafts(sessionId)` call after SSE. A streamed `contentId` can arrive before the session draft read path catches up, so the frontend now waits until the session draft query actually contains that ID.

Use a helper such as:

```typescript
void ensureSessionDraftVisible(
  queryClient,
  sessionId,
  contentId,
  () => chatService.getSessionDrafts(sessionId),
);
```

Then keep the editor-project side effects:

```typescript
void authenticatedFetchJson("/api/editor", {
  method: "POST",
  body: JSON.stringify({ generatedContentId: contentId }),
})
  .then(() => {
    void invalidateEditorProjectsQueries(queryClient);
    void invalidateChatProjectsQueries(queryClient);
  })
  .catch((err) => {
    if (status === 409 && body?.error === "project_exists") {
      void invalidateEditorProjectsQueries(queryClient);
      void invalidateChatProjectsQueries(queryClient);
      return;
    }
  });
```

`invalidateChatSessionQuery(sessionId)` still belongs to the stream completion path, not to SyncService.

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/domain/editor/build-initial-timeline.ts` | **DELETED** |
| `backend/src/domain/editor/merge-new-assets.ts` | **DELETED** |
| `backend/src/domain/editor/sync/sync.service.ts` | **NEW** |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Remove `mergedAssetIds` from `editProjects` |
| `backend/src/domain/editor/timeline/clip-trim.ts` | Add `source?: "content" \| "user"` to `TimelineClipJson` |
| `backend/src/domain/editor/editor.repository.ts` | Add `findProjectsByContentIds`, add `updateProjectForSync`, remove `updateTracksDurationMerged` |
| `backend/src/domain/editor/editor.service.ts` | Replace `buildInitialTimeline` with `syncService.deriveTimeline`, inject `SyncService`, remove `syncNewAssetsIntoProject` |
| `backend/src/domain/chat/chat-tools.ts` | Add `onContentSaved` to `ToolContext`, keep session draft membership / active-draft updates in the tool save path |
| `backend/src/domain/chat/send-message.stream.ts` | Set `onContentSaved` on `toolContext` |
| `backend/src/domain/singletons.ts` | Register `syncService` |
| `frontend/src/features/editor/types/editor.ts` | Add `source` to clip types |
| `frontend/src/features/editor/model/editor-reducer-clip-ops.ts` | Set `source: "user"` on `ADD_CLIP`, `ADD_CLIP_AUTO_PROMOTE`, `PASTE_CLIP` |
| `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts` | Wait for the streamed draft to become query-visible, then refresh editor/chat project caches |
