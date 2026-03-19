# Video Generation & Editor Systems — Audit Report

**Date:** 2026-03-18
**Scope:** `backend/src/routes/video/index.ts`, `backend/src/routes/editor/index.ts`, `backend/src/services/video/job.service.ts`, `backend/src/services/reels/content-generator.ts`, `backend/src/lib/chat-tools.ts`, `backend/src/routes/queue/index.ts`

---

## Critical Security Issues

### 1. Editor PATCH — Ownership Not Enforced in UPDATE
**File:** `backend/src/routes/editor/index.ts:179`

The ownership check queries with `and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id))` but the actual `UPDATE` statement only filters by `id`:

```ts
const [updated] = await db
  .update(editProjects)
  .set(updateData)
  .where(eq(editProjects.id, id))  // userId missing
  .returning(...);
```

TOCTOU gap: if the ownership check is ever bypassed or short-circuited, the update executes without user scoping.

---

### 2. Editor DELETE — Same Ownership Bypass
**File:** `backend/src/routes/editor/index.ts:219`

```ts
await db.delete(editProjects).where(eq(editProjects.id, id));
// Should include: and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id))
```

Same pattern as #1. The ownership check runs before the delete, but the delete itself has no user scope.

---

### 3. ffmpeg `drawtext` Text Injection
**File:** `backend/src/routes/editor/index.ts:540-543`

```ts
const safeText = clip.textContent.replace(/[':]/g, " ");
filterParts.push(`[${prevLabel}]drawtext=text='${safeText}':fontsize=48...`);
```

Sanitization only strips `'` and `:`. FFmpeg's `drawtext` filter also treats `\`, `%`, `{}`, `[]`, `;`, and newlines as special — any of these can break the filter graph or inject additional ffmpeg directives. The `tracks` field is stored as `z.array(z.unknown())` with no input validation, so arbitrary text reaches this interpolation point.

---

### 4. `tracks` Field Accepts Arbitrary Unknown Data
**File:** `backend/src/routes/editor/index.ts:27`

```ts
tracks: z.array(z.unknown()).optional(),
```

The `ClipData` and `TrackData` interfaces defined in the file are never enforced as Zod schemas. Arbitrary JSON is stored verbatim in the `jsonb` column and later blind-cast:

```ts
project.tracks as TrackData[]
```

No runtime structural validation between storage and use.

---

## Critical Bugs (Data Loss / Broken Features)

### 5. Double Job Status Update on Failure
**File:** `backend/src/routes/video/index.ts:1399-1414`

When `runAssembleFromExistingClips` fails, its inner catch block sets the job to `failed`. The outer `runReelGeneration` catch then sets it to `failed` again, overwriting `completedAt` and the error message with potentially different values. Failure attribution becomes inconsistent.

---

### 6. Shot Regeneration Creates Duplicate Clips
**File:** `backend/src/routes/video/index.ts:1418-1496`

`runShotRegenerate` inserts a new `video_clip` asset for shot index N but never deletes or invalidates the old one. `loadShotAssets` returns all assets sorted by `metadata.shotIndex` — when two assets share the same index, both are concatenated in the next assembly, producing a duplicate shot.

---

### 7. Retry Runner Uses Wrong Branch for `shot_regenerate`
**File:** `backend/src/routes/video/index.ts:1519-1529`

The `switch` on `job.kind` handles `assemble` and falls through to the `default` for both `reel_generate` and `shot_regenerate`. Retrying a `shot_regenerate` job silently runs `runReelGeneration` instead of `runShotRegenerate` — the full reel is regenerated from scratch, ignoring `shotIndex`.

---

### 8. `persistJob` Swallows Redis Write Errors
**File:** `backend/src/services/video/job.service.ts:115-132`

`persistJob` catches all errors, logs them, and does not re-throw. `createJob` returns a `VideoRenderJob` object even if Redis never stored it. The client receives `202` with a `jobId` that returns `404` forever.

---

### 9. `updateJob` Return Value Never Checked
**File:** `backend/src/services/video/job.service.ts:94-113`

`updateJob` returns `null` when the job is not found (expired TTL, or never persisted due to #8). Every call site in `video/index.ts` discards the return value. The `completed` update after a successful upload silently does nothing — the client never sees the job as done.

---

### 10. Assembly Error Handler Wipes Shot Metadata
**File:** `backend/src/routes/video/index.ts:1253-1258`

The assembly failure catch block calls:

```ts
await updatePhase4Metadata({
  existingGeneratedMetadata: null,  // always null
  ...
});
```

`updatePhase4Metadata` does `existing ?? {}`, so every assembly failure completely wipes the shot breakdown array previously written during clip generation.

---

### 11. `sceneDescription` Written to Column, Read from jsonb — Always Undefined
**File:** `backend/src/routes/video/index.ts:1310` + schema

Both insert paths write `sceneDescription` to the dedicated `generated_content.scene_description` column. But `runReelGeneration` reads it from:

```ts
const sceneDescription = content.generatedMetadata?.sceneDescription;
```

`generatedMetadata` (jsonb) is never populated with `sceneDescription`. Visual style context is silently dropped for every video generation job.

---

## Logic Errors

### 12. `loadAuxAudioAssets` Ignores Timeline Asset References
**File:** `backend/src/routes/video/index.ts:758-778`

Always picks the most recently created `voiceover` and `music` assets regardless of what the timeline `assetId` fields specify. If a user has generated multiple voiceovers, the most recent is always used.

---

### 13. `_buildInitialTimeline` Sets Audio `endMs` to Video Duration
**File:** `backend/src/routes/video/index.ts:455-470`

Both voiceover and music items get `endMs: durationMs` (total video duration). If the voiceover is shorter than the video, FFmpeg produces silence at the tail. `reelAssets.durationMs` is available and should be used instead.

---

### 14. Assembly Ignores the Timeline Entirely
**File:** `backend/src/routes/video/index.ts:1023-1026`

`runAssembleFromExistingClips` always uses all `video_clip` assets in DB order (sorted by `shotIndex`). Any reordering or removal of shots in the editor timeline is ignored.

---

### 15. Caption Timing Derived from Chunk Count, Not Voiceover Timestamps
**File:** `backend/src/routes/video/index.ts:663-709`

Captions are evenly distributed across `durationSec / chunks.length`. A 3-word chunk may get 2 seconds of display time while speaking for 0.5s, and vice versa. No alignment to TTS output timestamps.

---

### 16. `escapeAssText` Doesn't Escape All ASS Special Characters
**File:** `backend/src/routes/video/index.ts:659-661`

Removes `{}` and escapes backslashes. ASS/SSA also treats commas, `\N`, and newlines as special. Removing `{}` instead of escaping the braces corrupts any script text using curly braces.

---

### 17. `parseScriptShots` Throws on Empty Lines, Making Single-Shot Fallback Unreachable
**File:** `backend/src/routes/video/utils.ts:56-57`

Returns `[]` for `null` scripts (reaching the single-shot fallback at line 1300), but throws for whitespace-only strings. The single-shot fallback is unreachable for this case — the job fails instead of falling back.

---

### 18. Unbounded `while(true)` Chain Walk in `createIterateContentTool`
**File:** `backend/src/lib/chat-tools.ts:302-316`

No cycle detection and no iteration cap on the `parentId` chain walk. Circular references hang the request indefinitely. Also N sequential DB round-trips for deeply iterated content.

---

### 19. Queue DELETE Resets Published Content to Draft
**File:** `backend/src/routes/queue/index.ts:600-606`

```ts
await db.update(generatedContent).set({ status: "draft" }).where(...);
```

Deleting a queue item resets content to `"draft"` regardless of whether the content is already `"published"`. Should only reset when current status is `"queued"`.

---

### 20. `content-generator.ts` Auto-Enqueue Leaves `generatedContent.status` as `"draft"`
**File:** `backend/src/services/reels/content-generator.ts:133-141`

The manual `POST /api/queue` route correctly sets `generatedContent.status = "queued"`. The auto-enqueue path in `content-generator.ts` skips this — the content row stays `"draft"` while already in the queue, creating a state desync.

---

### 21. `iterateContent` Does Not Auto-Enqueue New Version
**File:** `backend/src/lib/chat-tools.ts:330-354`

`createSaveContentTool` auto-inserts into `queueItems` after saving. `createIterateContentTool` does not. Iterated versions never appear in the pipeline queue without a manual `POST /api/queue` call.

---

### 22. `getAssetTypeForTrack` Returns Audio Types for Video Track Items
**File:** `backend/src/routes/video/index.ts:135-142`

When `track === "video"` and no `role` is set, the fallback returns `["voiceover", "music"]` instead of `["video_clip"]`. Video assets placed in the video track with no role fail the type check with `ASSET_TYPE_MISMATCH`.

---

### 23. `setJobProgress` Always Hard-codes `status: "rendering"`
**File:** `backend/src/routes/editor/index.ts:370-375`

```ts
async function setJobProgress(jobId: string, progress: number) {
  await db.update(exportJobs).set({ progress, status: "rendering" }).where(...);
}
```

Cannot represent intermediate states. If ever called after an error path, silently resets the terminal status back to `"rendering"`.

---

## Missing Validations

### 24. No Concurrent Job Guard — Unlimited Parallel Reel Jobs
**File:** `backend/src/routes/video/index.ts`

No check for an in-flight job before creating a new one. Users can POST unlimited parallel reel generation jobs within rate limits, each spawning a separate process writing to the same `generatedContentId`. Duplicate `video_clip` assets accumulate per shot index.

---

### 25. `shotIndex` Has No Maximum Bound
**File:** `backend/src/routes/video/index.ts:50-57`

```ts
shotIndex: z.number().int().min(0)
// Missing: .max(N)
```

A client can send `shotIndex: 99999`. The worker inserts an asset with that index, which is sorted to the end of every future assembly, silently appending a stray clip.

---

### 26. No Validation That Content Has Completed Earlier Pipeline Phases
**File:** `backend/src/routes/video/index.ts`

Users can call `POST /api/video/reel` on content with status `"draft"` and no `generatedScript`. The worker silently falls back to single-shot mode using `generatedHook` as the prompt instead of failing with a clear error.

---

### 27. `generatedContentId` on Editor Project Create Not Ownership-Verified
**File:** `backend/src/routes/editor/index.ts:83-94`

A user can link any `generatedContentId` to their edit project — the value is inserted without checking that the authenticated user owns that `generated_content` row.

---

### 28. Export Status Endpoint Doesn't Verify Project Exists
**File:** `backend/src/routes/editor/index.ts:296-344`

The status endpoint only queries `exportJobs` filtered by `editProjectId` and `userId`. It never verifies the project itself exists and belongs to the user. Valid projects with no exports and invalid project IDs both return `{ status: "idle" }` — a subtle information leak for project ID enumeration.

---

### 29. No Limit on Edit Projects Per User
**File:** `backend/src/routes/editor/index.ts`

No guard preventing a user from creating unlimited edit projects. Combined with unbounded export job spawning, this is a resource exhaustion vector.

---

### 30. Duplicate Queue Items Possible via `POST /api/queue`
**File:** `backend/src/routes/queue/index.ts:316-324`

The manual queue creation endpoint does a plain insert without conflict handling. There is no unique constraint on `(userId, generatedContentId)` in `queueItems`, so calling this endpoint multiple times creates duplicate queue rows. The `.onConflictDoNothing()` in `chat-tools.ts` and `content-generator.ts` never actually triggers.

---

## Architectural Issues

### 31. `enqueue` Is Just `setTimeout(..., 0)` — Not a Real Queue
**File:** `backend/src/routes/video/index.ts:1498-1505`

```ts
function enqueue(kind: VideoJobKind, fn: () => Promise<void>): void {
  setTimeout(() => void fn(), 0);
}
```

No concurrency limit, no persistence, no retry, no backpressure. Server restart loses all pending/running jobs — Redis records stay in `"running"` state indefinitely with no recovery mechanism.

---

### 32. Export Job Runs In-Process with No Isolation
**File:** `backend/src/routes/editor/index.ts:273-280`

The entire ffmpeg render runs inside the HTTP server process. An OOM (from `Buffer.from(await res.arrayBuffer())` on large files) or ffmpeg crash can affect the entire Hono server. No worker isolation, no backpressure.

---

### 33. Firebase Token Verified Twice Per Mutation
**File:** `backend/src/middleware/protection.ts:79-186`

Both `csrfMiddleware` and `authMiddleware` call `adminAuth.verifyIdToken(token, true)`. Every POST/PATCH/DELETE makes two sequential Firebase token verification round-trips, doubling latency and Firebase API quota usage.

---

### 34. R2 Key/URL Mismatch in Development
**File:** `backend/src/routes/video/index.ts:1184, 1215`

`assembledR2Key` is built without the `testing/` prefix that `uploadFile` applies in development. The stored `videoUrl` points to the wrong key (`${R2_PUBLIC_URL}/${assembledR2Key}` uses the bare key). `getFileUrl` also applies the `testing/` prefix again, producing `testing/testing/assembled/...`.

---

### 35. `upsertAssembledAsset` Only Inserts, Never Upserts
**File:** `backend/src/routes/video/index.ts:913-935`

Every `runAssembleFromExistingClips` call inserts a new `assembled_video` asset. Multiple assembly runs accumulate stale rows with no cleanup path.

---

### 36. `_validateTimeline` and `_timelineSchema` Are Dead Code
**File:** `backend/src/routes/video/index.ts`

Both are defined (underscore-prefixed) but never called by any route handler. The `assemble` route does not validate the timeline.

---

### 37. Two Diverging `outputType` Enums
**File:** `backend/src/services/reels/content-generator.ts` vs `backend/src/lib/chat-tools.ts`

- Old path: `"hook" | "caption" | "full"`
- New chat path: `"hook_only" | "caption_only" | "full_script"`

Any code switching on `outputType` must handle both sets or silently produces wrong behavior.

---

### 38. `inArray` Dynamically Imported Inside Export Job Function
**File:** `backend/src/routes/editor/index.ts:415`

```ts
const { inArray } = await import("drizzle-orm");
```

Should be a top-level import. Unnecessary module resolution overhead on every export job.

---

### 39. `editProjectsRelations` and `exportJobsRelations` Missing from Schema
**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

Drizzle's relational query API (`db.query.editProjects.findMany({ with: { exportJobs: true } })`) cannot be used because no relation blocks are defined for these tables.

---

### 40. Undo/Redo History Is Unbounded
**File:** `frontend/src/features/editor/hooks/useEditorStore.ts:103-108`

The `past` array grows without limit. Drag-heavy timeline sessions accumulate tens of thousands of entries, causing memory pressure and increasingly expensive React re-renders.

---

## Summary by Severity

| Severity | Count | Items |
|---|---|---|
| Critical Security | 4 | #1–4 |
| Critical Bug (data loss) | 7 | #5–11 |
| Logic Error | 12 | #12–23 |
| Missing Validation | 7 | #24–30 |
| Architectural | 10 | #31–40 |
| **Total** | **40** | |
