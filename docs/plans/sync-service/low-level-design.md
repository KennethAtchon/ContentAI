# SyncService — Low Level Design

Implementation plan. Read `high-level-design.md` first while this folder still exists.

**This folder (including `firing-map.md`) is planning material and will be removed later.** The implementation must not depend on it staying in the repo. **All behavior that matters — firing map, constraints, merge rules, wiring — must live in source comments** (and tests), written so a maintainer never needs these markdown files.

---

## In-code documentation (required)

The LLD shows **shapes** of code, not the commentary the shipped tree must carry. Treat verbose, accurate comments as part of the deliverable; they are the **long-term** documentation.

**`sync.service.ts`**

- **Module- or class-level block (must subsume the firing map):** Spell out, in prose or structured comment, **every** path that triggers sync and **every** important path that does not (e.g. which chat tools call `onContentSaved` / `syncLinkedProjects`, which video tools do not). State that sync completes **before** the SSE event reaches the client. List invariants: no autosave version bump on `updateProjectForSync`, preservation of the existing video track when a fresh derive has zero video clips, user-sourced clips untouched, content-sourced clips replaced with trim/layout preserved per `assetId`, ancestor chain / `generatedContentId` behavior as implemented — enough detail that deleting `firing-map.md` loses no operational knowledge.
- **Public methods:** JSDoc that a future maintainer can trust — purpose, caller context, and ordering guarantees where they matter.
- **Private helpers (especially `mergeTrackSets`):** Explain **why** each rule exists and what breaks if it is violated, not just the mechanics of the loop. Call out edge cases (empty tracks, missing assets, idempotent caption path).

**Wiring and call sites**

- **`send-message.stream.ts`**, **`chat-tools.ts`**, **`editor.service.ts`:** Comments at the callback injection, tool success path, or `deriveTimeline` call that document the **full** trigger chain end-to-end (who sets `savedContentId`, what runs next, what the client observes after). A reader of any one file must not need the deleted docs to understand how sync is reached.

**Bar to clear**

After `docs/plans/sync-service/` is gone, someone can still learn SyncService entirely from the backend source (and tests). Do not reference these plan files from production code as the place to “read more” — paste the substance into comments instead.

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

**NOT deleted:** `refreshEditorTimeline` on `IEditorRepository` — still used by video job runner.

---

## Schema Change

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

Remove from `editProjects`:
```typescript
// DELETE this line:
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
   * Stateless — always produces source:"content" clips from current DB state.
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
      // transcribeAsset is idempotent — returns existing captionDocId if asset already has one
      const { captionDocId } = await this.captionsService.transcribeAsset(userId, voiceoverAsset.id);
      tracks.find((t) => t.type === "text")!.clips = [
        buildCaptionClip({ captionDocId, voiceoverAsset, voiceoverClipId: null }) as unknown as TimelineClipJson,
      ];
    } catch (err) {
      debugLog.warn("Caption transcription failed during deriveTimeline", {
        service: "sync-service", contentId,
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
private emptyTracks(): TimelineTrackJson[] {
  return [
    { id: crypto.randomUUID(), type: "video",  name: "Video",     muted: false, locked: false, clips: [], transitions: [] },
    { id: crypto.randomUUID(), type: "audio",  name: "Voiceover", muted: false, locked: false, clips: [], transitions: [] },
    { id: crypto.randomUUID(), type: "music",  name: "Music",     muted: false, locked: false, clips: [], transitions: [] },
    { id: crypto.randomUUID(), type: "text",   name: "Text",      muted: false, locked: false, clips: [], transitions: [] },
  ];
}

private buildVideoClips(assets: ContentAssetRow[]): TimelineClipJson[] {
  let cursor = 0;
  return assets.map((asset) => {
    const dur = Math.max(1, asset.durationMs ?? 5000);
    const meta = (asset.metadata as Record<string, unknown>) ?? {};
    const label = typeof meta.generationPrompt === "string"
      ? meta.generationPrompt
      : `Shot ${this.shotIndex(asset.metadata) + 1}`;
    const clip = normalizeMediaClipTrimFields(dur, {
      id: crypto.randomUUID(),
      type: "video", assetId: asset.id, label,
      startMs: cursor, source: "content" as const,
      speed: 1, enabled: true, opacity: 1,
      warmth: 0, contrast: 0,
      positionX: 0, positionY: 0, scale: 1, rotation: 0,
      volume: 1, muted: false,
    });
    cursor += Number(clip.durationMs ?? dur);
    return clip;
  });
}

private buildAudioClip(asset: ContentAssetRow, idPrefix: string, label: string, volume: number): TimelineClipJson {
  const dur = Math.max(1, asset.durationMs ?? 0);
  return normalizeMediaClipTrimFields(dur, {
    id: `${idPrefix}-${asset.id}`,
    type: idPrefix === "music" ? "music" : "audio",
    assetId: asset.id, label, startMs: 0,
    source: "content" as const,
    speed: 1, enabled: true, opacity: 1,
    warmth: 0, contrast: 0,
    positionX: 0, positionY: 0, scale: 1, rotation: 0,
    volume, muted: false,
  });
}

/**
 * Merge fresh content-derived tracks with existing project tracks.
 * Rules:
 * 1. User clips (source:"user") always carried forward untouched.
 * 2. Content clips replaced by fresh ones, EXCEPT adjustments (trims, position,
 *    scale, rotation) are preserved when the same assetId existed before.
 * 3. If fresh video track is empty (new content version, no videos yet),
 *    keep existing video clips unchanged.
 */
private mergeTrackSets(fresh: TimelineTrackJson[], existing: TimelineTrackJson[]): TimelineTrackJson[] {
  const existingByAssetId = new Map<string, ClipUserAdjustments>();
  for (const track of existing) {
    for (const clip of track.clips) {
      if (clip.source === "content" && typeof clip.assetId === "string") {
        existingByAssetId.set(clip.assetId, {
          trimStartMs: Number(clip.trimStartMs ?? 0),
          trimEndMs:   Number(clip.trimEndMs ?? 0),
          durationMs:  Number(clip.durationMs ?? 0),
          positionX:   Number(clip.positionX ?? 0),
          positionY:   Number(clip.positionY ?? 0),
          scale:       Number(clip.scale ?? 1),
          rotation:    Number(clip.rotation ?? 0),
        });
      }
    }
  }

  return fresh.map((freshTrack) => {
    const existingTrack = existing.find((t) => t.type === freshTrack.type);

    // Video track preservation: if fresh has no clips, keep existing video unchanged
    if (freshTrack.type === "video" && freshTrack.clips.length === 0) {
      return existingTrack ?? freshTrack;
    }

    const userClips = existingTrack?.clips.filter((c) => c.source === "user") ?? [];

    const reconciledClips = freshTrack.clips.map((clip) => {
      const prior = typeof clip.assetId === "string" ? existingByAssetId.get(clip.assetId) : undefined;
      if (!prior) return clip;
      return { ...clip, trimStartMs: prior.trimStartMs, trimEndMs: prior.trimEndMs, durationMs: prior.durationMs, positionX: prior.positionX, positionY: prior.positionY, scale: prior.scale, rotation: prior.rotation };
    });

    return { ...freshTrack, clips: [...reconciledClips, ...userClips] };
  });
}

private shotIndex(metadata: unknown): number {
  const m = metadata as Record<string, unknown> | null | undefined;
  if (!m) return -1;
  const v = m.shotIndex ?? m.shot_index;
  if (typeof v === "number") return v;
  if (typeof v === "string" && !Number.isNaN(Number(v))) return Number(v);
  return -1;
}

private computeDuration(tracks: TimelineTrackJson[]): number {
  let maxEnd = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      maxEnd = Math.max(maxEnd, Number(clip.startMs ?? 0) + Number(clip.durationMs ?? 0));
    }
  }
  return Math.min(Math.max(maxEnd, 1000), 180_000);
}
```

---

## `source` Field on Clip Types

**Backend — `backend/src/domain/editor/timeline/clip-trim.ts`:**

Add to `TimelineClipJson`:
```typescript
source?: "content" | "user";
```

**Frontend — `frontend/src/features/editor/types/editor.ts`:**

Add to `MediaClipBase` (covers `VideoClip`, `AudioClip`, `MusicClip`) and `TextClip`:
```typescript
source?: "content" | "user";
```

**Frontend — `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`:**

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
): Promise<{ id: string; tracks: unknown; durationMs: number }[]> {
  if (contentIds.length === 0) return [];
  return this.db
    .select({ id: editProjects.id, tracks: editProjects.tracks, durationMs: editProjects.durationMs })
    .from(editProjects)
    .where(and(
      eq(editProjects.userId, userId),
      inArray(editProjects.generatedContentId, contentIds),
    ));
}
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
): Promise<void> {
  await this.db
    .update(editProjects)
    .set({
      tracks: data.tracks,
      durationMs: data.durationMs,
      generatedContentId: data.generatedContentId,
      generatedHook: data.generatedHook,
      postCaption: data.postCaption,
      // NOTE: no version bump — sync is transparent to autosave conflict detection
    })
    .where(and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)));
}
```

---

## Wiring: `ToolContext` Callback

**File:** `backend/src/domain/chat/chat-tools.ts`

```typescript
export interface ToolContext {
  auth: HonoEnv["Variables"]["auth"];
  content: string;
  reelRefs?: number[];
  savedContentId?: number;
  onContentSaved?: (contentId: number) => Promise<void>; // ADD
}
```

In `save_content`, `iterate_content`, and `edit_content_field` execute functions, after the DB write:
```typescript
context.savedContentId = row.id;
await context.onContentSaved?.(row.id);
return { success: true, contentId: row.id };
```

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

`syncService` injected via singleton — see below.

---

## Wiring: `EditorService.createEditorProject`

**File:** `backend/src/domain/editor/editor.service.ts`

Replace:
```typescript
// OLD
import { buildInitialTimeline } from "./build-initial-timeline";
const result = await buildInitialTimeline(this.content, generatedContentId, userId, this.captionsService);

// NEW
// syncService injected in constructor
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

## Frontend: Cache Invalidation

**File:** `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts`

Add `sessionId` parameter. Add `invalidateSessionDrafts` to both the success and 409 branches:

```typescript
.then(() => {
  void invalidateEditorProjectsQueries(queryClient);
  void invalidateChatProjectsQueries(queryClient);
  void invalidateSessionDrafts(queryClient, sessionId); // ADD
})
.catch((err) => {
  if (status === 409 && body?.error === "project_exists") {
    void invalidateEditorProjectsQueries(queryClient);
    void invalidateChatProjectsQueries(queryClient);
    void invalidateSessionDrafts(queryClient, sessionId); // ADD
    return;
  }
});
```

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
| `backend/src/domain/chat/chat-tools.ts` | Add `onContentSaved` to `ToolContext`, call it in `save_content` / `iterate_content` / `edit_content_field` |
| `backend/src/domain/chat/send-message.stream.ts` | Set `onContentSaved` on `toolContext` |
| `backend/src/domain/singletons.ts` | Register `syncService` |
| `frontend/src/features/editor/types/editor.ts` | Add `source` to clip types |
| `frontend/src/features/editor/model/editor-reducer-clip-ops.ts` | Set `source: "user"` on `ADD_CLIP`, `ADD_CLIP_AUTO_PROMOTE`, `PASTE_CLIP` |
| `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts` | Add `sessionId` param, add `invalidateSessionDrafts` to both branches |
