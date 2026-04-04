# SyncService - Low Level Design

Read `high-level-design.md` first while this folder still exists.

**This folder is planning material and will be removed later.** The implementation must not depend on it staying. **All behavior that matters — firing map, constraints, merge rules, wiring, and Phase 2 TODOs — must live in source code comments** (and tests), written so a maintainer never needs these markdown files.

---

## Phase 1 scope reminder

Everything in this LLD is Phase 1 only: text content sync, full re-derive, merge user adjustments back in. The Phase 2 extension points are noted inline as `// TODO (Phase 2):` markers. Do not implement Phase 2 logic during Phase 1 — just make sure the structure does not prevent it.

---

## In-code documentation (required)

The LLD shows shapes of code. Treat verbose, accurate comments as part of the deliverable — they are the long-term documentation after this folder is deleted.

### `sync.service.ts` (module-level block, required)

Must cover:
- Every path that triggers sync and every important path that does not (subsume the firing map)
- Sync completes **before** the SSE event reaches the client
- No autosave version bump on `updateProjectForSync`
- Video track preservation when fresh derive has zero video clips
- User-sourced clips untouched; content-sourced clips replaced with trim/layout preserved per `assetId`
- Ancestor chain / `generatedContentId` behavior
- Chat session draft membership / `activeContentId` owned elsewhere by the chat tool save path
- Phase 2 TODO markers for AI direct-edit extension

### `sync.service.ts` (public methods)

JSDoc on each public method with: purpose, caller context, ordering guarantees.

### `sync.service.ts` (`mergeTrackSets`)

Explain **why** each rule exists and what breaks if it is violated, not just mechanics. Call out edge cases: empty tracks, missing assets, idempotent caption path. Include Phase 2 TODO for `"ai_edit"` source type.

### Wiring call sites

- `send-message.stream.ts` — comment at the callback injection documenting the full trigger chain
- `chat-tools.ts` — comment at the tool success paths documenting who sets the saved content ID and what runs next
- `editor.service.ts` — comment at the `deriveTimeline` call documenting the init flow vs sync flow distinction

**Bar to clear:** After `docs/plans/sync-service/` is gone, someone can learn SyncService entirely from the backend source (and tests). Do not reference plan files from production code.

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

**NOT deleted:** `refreshEditorTimeline` on `IEditorRepository` — still used by the video job runner.

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

### Module-level comment (write this verbatim)

```typescript
/**
 * SyncService — keeps editor project timelines in sync with AI-generated content.
 *
 * WHAT IT DOES (Phase 1):
 * After any text content tool call succeeds (save_content, iterate_content,
 * edit_content_field), this service re-derives the editor timeline from the
 * latest content assets and writes it back to all linked editor projects before
 * the SSE event fires to the frontend. "Sync" means the editor is always
 * showing the latest content state when the user reads the streamed response.
 *
 * FIRING MAP:
 * - save_content      → sets savedContentId → onContentSaved → syncLinkedProjects ✓
 * - iterate_content   → sets savedContentId → onContentSaved → syncLinkedProjects ✓
 * - edit_content_field → sets savedContentId → onContentSaved → syncLinkedProjects ✓
 * - generate_video_reel    → NO. Async job. Uses refreshEditorTimeline instead.
 * - regenerate_video_shot  → NO. Async job. Uses refreshEditorTimeline instead.
 * - editor autosave        → NO. Editor-to-backend only.
 * - project creation       → NO. EditorService.createEditorProject calls
 *                               deriveTimeline directly for initial setup.
 *
 * ORDERING GUARANTEE:
 * Sync completes before the SSE event reaches the client. The call chain is:
 *   tool success → onContentSaved → syncLinkedProjects → updateProjectForSync
 *   → SSE fires → client re-fetches → MERGE_TRACKS_FROM_SERVER
 *
 * INVARIANTS:
 * - updateProjectForSync never increments the autosave conflict version.
 *   Sync is transparent to the editor's conflict detection system.
 * - If the editor autosaves after sync writes, the editor's local state wins.
 *   This is intentional: user edits are never discarded by AI activity.
 * - If deriveTimeline returns zero video clips for a new content version
 *   (because video has not been regenerated yet), the existing video clips
 *   are preserved unchanged. Only non-empty tracks replace existing tracks.
 * - User-sourced clips (source: "user") are always carried forward untouched.
 * - Content-sourced clips (source: "content") are replaced by fresh ones,
 *   with trim/position adjustments preserved when the same assetId existed.
 * - CaptionsService.transcribeAsset is idempotent: same assetId → same
 *   captionDocId → user caption style edits survive re-sync.
 * - chat_session_content membership and chat_sessions.activeContentId are
 *   owned by the chat tool save path, not by SyncService. SyncService
 *   receives the already-saved contentId and reacts to it.
 *
 * TODO (Phase 2 — AI direct-edit integration):
 * When AI tools can directly manipulate the timeline (trim clips, reorder shots,
 * set caption presets, create text overlays), this service needs to grow in
 * two directions:
 *
 * 1. A new ToolContext callback: onEditorAction(projectId, operations[])
 *    This dispatches direct clip mutations without requiring a new content version.
 *    Operations would be typed commands: { type: "trim_clip", clipId, durationMs }
 *    etc. SyncService (or a sibling EditorActionService) would apply them via
 *    a new IEditorRepository method: applyClipOperations().
 *
 * 2. Extended source field: source: "content" | "user" | "ai_edit"
 *    AI-placed clips need their own source value so mergeTrackSets can apply
 *    the right merge rules. "ai_edit" clips should survive text content re-syncs
 *    but be replaceable by subsequent AI edits and overrideable by user edits.
 *
 * 3. Assembly tool wiring: ai-assembly-tracks.ts already has convertAIResponseToTracks()
 *    and buildStandardPresetTracks(). These need to be called from a new chat tool
 *    (e.g., assemble_video_cut) that lets the AI arrange shots with full timing control.
 *    The result would feed into this service's syncLinkedProjects flow.
 *
 * See high-level-design.md (Phase 2 section) for the full vision.
 */
```

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

### Class shape

```typescript
export class SyncService {
  constructor(
    private readonly editor: IEditorRepository,
    private readonly content: IContentRepository,
    private readonly captionsService: CaptionsService,
  ) {}

  /**
   * Build a fresh timeline from a content record's assets.
   *
   * Stateless — always produces source:"content" clips from current DB state.
   * Used by EditorService.createEditorProject for initial project setup, and
   * as the base for syncLinkedProjects on every subsequent text content change.
   *
   * Returns empty tracks with durationMs:0 if the content has no assets yet
   * (e.g., content was saved before any voiceover or video was generated).
   *
   * TODO (Phase 2): When the AI assembly tool (assemble_video_cut) exists,
   * this method should accept an optional AssemblyPlan parameter that overrides
   * the default sequential shot ordering with AI-directed cut timing.
   */
  async deriveTimeline(
    userId: string,
    contentId: number,
  ): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }> { ... }

  /**
   * Re-sync all editor projects linked to this content or any ancestor in its chain.
   *
   * Called by send-message.stream.ts via ToolContext.onContentSaved after any
   * text content tool call succeeds. Must complete before SSE fires.
   *
   * Walks the ancestor chain so that a project created against content v1 is
   * still found and updated when content v3 is saved.
   *
   * TODO (Phase 2): When AI direct-edit operations exist, this method (or a
   * sibling) will also accept a list of clip operations to apply after re-derive,
   * allowing AI to both update content fields AND make targeted clip edits in
   * a single sync cycle.
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
 * Merge fresh content-derived tracks with the existing project's tracks.
 *
 * Rules (Phase 1):
 *
 * 1. User clips (source:"user") are always carried forward untouched, appended
 *    after content clips. Rationale: user-added clips are not derived from AI
 *    content and should never be affected by an AI content change.
 *
 * 2. Content clips (source:"content" or no source field) are replaced by the
 *    fresh set from deriveTimeline. Rationale: these are AI-owned — the AI's
 *    latest content state is authoritative for them.
 *
 * 3. When a fresh content clip shares the same assetId as an existing clip,
 *    the user's trim/position adjustments (trimStartMs, trimEndMs, durationMs,
 *    positionX, positionY, scale, rotation) are carried forward onto the fresh
 *    clip. Rationale: the user may have manually trimmed a shot; that work
 *    should survive a text-only re-sync where the video asset did not change.
 *
 * 4. If the fresh video track has zero clips (new content version, no video
 *    generated yet), the existing video clips are kept unchanged. Only non-empty
 *    tracks replace their existing counterparts. Rationale: it would be
 *    confusing and destructive to blank the video track just because the user
 *    rewrote the script without regenerating video.
 *
 * TODO (Phase 2 — "ai_edit" source type):
 * When AI direct-edit tools exist, clips placed by AI operations will carry
 * source:"ai_edit". The merge rules need to be extended:
 * - "ai_edit" clips survive text content re-syncs (they were explicitly placed
 *   by AI intent, not derived from assets).
 * - "ai_edit" clips are replaceable by a subsequent AI edit operation.
 * - "ai_edit" clips are overrideable by user manual edits (user wins).
 * The exact semantics here will depend on the operational model chosen for
 * Phase 2 (last-write-wins vs command log vs CRDTs).
 */
private mergeTrackSets(fresh: TimelineTrackJson[], existing: TimelineTrackJson[]): TimelineTrackJson[] { ... }

private shotIndex(metadata: unknown): number { ... }
private computeDuration(tracks: TimelineTrackJson[]): number { ... }
```

---

## `source` Field on Clip Types

**Backend — `backend/src/domain/editor/timeline/clip-trim.ts`:**

Add to `TimelineClipJson`:

```typescript
/**
 * Who placed this clip on the timeline.
 * - "content": derived from AI-generated content assets (SyncService)
 * - "user": manually added by the user in the editor
 *
 * TODO (Phase 2): Add "ai_edit" for clips placed by AI direct-edit tools.
 * This is the discriminator that mergeTrackSets will use to decide whose
 * intent wins during a sync conflict.
 */
source?: "content" | "user";
```

**Frontend — `frontend/src/features/editor/types/editor.ts`:**

Add to `MediaClipBase` (covers `VideoClip`, `AudioClip`, `MusicClip`) and `TextClip`:

```typescript
source?: "content" | "user";
```

**Frontend — `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`:**

In `ADD_CLIP`, `ADD_CLIP_AUTO_PROMOTE`, and `PASTE_CLIP` cases:

```typescript
clips: [...t.clips, { ...action.clip, locallyModified: true, source: "user" as const }],
```

---

## New Repository Methods

**File:** `backend/src/domain/editor/editor.repository.ts`

### `findProjectsByContentIds`

```typescript
/**
 * Find all editor projects for a user that are linked to any of the given
 * content IDs. Used by syncLinkedProjects to find projects across the full
 * ancestor chain of a content version.
 */
async findProjectsByContentIds(
  userId: string,
  contentIds: number[],
): Promise<{ id: string; tracks: unknown; durationMs: number }[]> { ... }
```

### `updateProjectForSync`

```typescript
/**
 * Write synced tracks and denormalized content fields to an editor project.
 *
 * IMPORTANT: This must NOT bump any autosave/conflict version field.
 * Sync writes are transparent to the editor's conflict detection system.
 * If the autosave incremented the version here, it would cause false 409
 * conflicts whenever the user's editor tab autosaved after a sync.
 *
 * TODO (Phase 2): When AI direct-edit operations exist, a new method
 * (applyClipOperations or similar) should handle targeted clip mutations.
 * Do not add operation-level logic to this method — keep it for full-track
 * sync writes only.
 */
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

---

## Wiring: `ToolContext` Callback

**File:** `backend/src/domain/chat/chat-tools.ts`

The current `ToolContext` interface needs `onContentSaved`:

```typescript
export interface ToolContext {
  auth: HonoEnv["Variables"]["auth"];
  sessionId: string;
  content: string;
  reelRefs?: number[];
  savedContentIds: number[];
  /**
   * Called by save_content, iterate_content, and edit_content_field after
   * the DB write and session draft update succeed. SyncService uses this to
   * update linked editor projects before SSE fires.
   *
   * TODO (Phase 2): Add onEditorAction callback here for AI tools that
   * directly manipulate the timeline without creating a new content version.
   * Shape: onEditorAction?: (projectId: string, ops: ClipOperation[]) => Promise<void>
   * This allows AI to trim clips, reorder shots, apply effects, etc. in response
   * to user chat messages — without going through the full content save path.
   */
  onContentSaved?: (contentId: number) => Promise<void>;
}
```

In `save_content`, `iterate_content`, and `edit_content_field`, after the DB write and session draft update:

```typescript
context.savedContentIds.push(row.id);
await context.onContentSaved?.(row.id);
return { success: true, contentId: row.id };
```

**File:** `backend/src/domain/chat/send-message.stream.ts`

```typescript
const toolContext: ToolContext = {
  auth,
  sessionId,
  content,
  reelRefs,
  savedContentIds: [],
  // SyncService runs here, before the SSE event fires to the client.
  // Ordering: tool saves content + updates session draft state →
  //   onContentSaved fires → syncLinkedProjects writes editor projects →
  //   SSE reveals contentId → client waits for draft to be query-visible →
  //   editor queries re-fetch and merge MERGE_TRACKS_FROM_SERVER.
  onContentSaved: (contentId) => syncService.syncLinkedProjects(auth.user.id, contentId),
};
```

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
// SyncService.deriveTimeline is the single source of truth for building
// editor tracks from content assets — used here for initial project creation
// and by syncLinkedProjects for all subsequent re-syncs. See sync.service.ts.
const result = await this.syncService.deriveTimeline(userId, generatedContentId);
```

Inject `SyncService` into `EditorService` constructor. Remove `syncNewAssetsIntoProject()` entirely.

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

After SSE reveals a `contentId`, the frontend must:

1. Wait until that draft is visible in the session draft query (not just invalidate once):

```typescript
void ensureSessionDraftVisible(
  queryClient,
  sessionId,
  contentId,
  () => chatService.getSessionDrafts(sessionId),
);
```

2. Create/refresh the editor project:

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

`invalidateChatSessionQuery(sessionId)` still belongs to the stream completion path.

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/domain/editor/build-initial-timeline.ts` | **DELETED** |
| `backend/src/domain/editor/merge-new-assets.ts` | **DELETED** |
| `backend/src/domain/editor/sync/sync.service.ts` | **NEW** — Phase 1 implementation + Phase 2 TODO comments |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Remove `mergedAssetIds` from `editProjects` |
| `backend/src/domain/editor/timeline/clip-trim.ts` | Add `source?: "content" \| "user"` with Phase 2 TODO comment |
| `backend/src/domain/editor/editor.repository.ts` | Add `findProjectsByContentIds`, `updateProjectForSync`; remove `updateTracksDurationMerged` |
| `backend/src/domain/editor/editor.service.ts` | Replace `buildInitialTimeline` with `syncService.deriveTimeline`, inject `SyncService`, remove `syncNewAssetsIntoProject` |
| `backend/src/domain/chat/chat-tools.ts` | Add `onContentSaved` to `ToolContext` with Phase 2 TODO for `onEditorAction` |
| `backend/src/domain/chat/send-message.stream.ts` | Set `onContentSaved` on `toolContext` with ordering comment |
| `backend/src/domain/singletons.ts` | Register `syncService` |
| `backend/src/domain/editor/timeline/ai-assembly-tracks.ts` | Add Phase 2 TODO comments at `convertAIResponseToTracks` and `buildStandardPresetTracks` |
| `frontend/src/features/editor/types/editor.ts` | Add `source` to clip types |
| `frontend/src/features/editor/model/editor-reducer-clip-ops.ts` | Set `source: "user"` on `ADD_CLIP`, `ADD_CLIP_AUTO_PROMOTE`, `PASTE_CLIP` |
| `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts` | Wait for draft visibility, then refresh editor/chat project caches |
