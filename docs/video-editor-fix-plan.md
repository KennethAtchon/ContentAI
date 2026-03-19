# Video Generation & Editor Systems — Fix Plan

**Date:** 2026-03-18
**Reference:** [video-editor-audit.md](./video-editor-audit.md)

Fixes are grouped into phases by priority. Each phase can be worked independently. Audit issue numbers (#N) reference the audit doc.

---

## Phase 1 — Critical Security (Fix First)

These are exploitable bugs. Fix before any other work.

### 1.1 Add `userId` to Editor PATCH and DELETE WHERE Clauses
**Audit:** #1, #2
**File:** `backend/src/routes/editor/index.ts`

- In the `PATCH /:id` handler, change the `UPDATE` WHERE clause to `and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id))`
- In the `DELETE /:id` handler, change the `DELETE` WHERE clause to the same
- Apply same fix to `PATCH /api/queue/:id` (`queueItems` update)
- Pattern to follow: every `SELECT` for ownership check already uses both conditions — the `UPDATE`/`DELETE` must match

### 1.2 Validate `tracks` Field with a Real Zod Schema
**Audit:** #4
**File:** `backend/src/routes/editor/index.ts`

- Define Zod schemas for `ClipData` and `TrackData` (the interfaces already exist, convert them)
- Replace `z.array(z.unknown())` with `z.array(trackDataSchema)` in `patchProjectSchema`
- Use the same schema for `exportSchema`'s `tracks` field
- Add strict enum validation for `clip.type` (`"video" | "audio" | "text"`)

### 1.3 Fix ffmpeg `drawtext` Text Injection
**Audit:** #3
**File:** `backend/src/routes/editor/index.ts`

- Replace inline string interpolation with proper FFmpeg escaping
- Escape these characters in text content: `\`, `'`, `:`, `%`, `{`, `}`, `[`, `]`, `;`, newlines
- Consider using `ffmpeg`'s `textfile` option (write text to a temp file) instead of inline interpolation to avoid the escaping problem entirely

---

## Phase 2 — Critical Bugs (Data Correctness)

These cause incorrect output or phantom job IDs.

### 2.1 Fix `persistJob` to Propagate Redis Errors
**Audit:** #8, #9
**File:** `backend/src/services/video/job.service.ts`

- Remove the `try/catch` that swallows errors in `persistJob`, or re-throw after logging
- `createJob` should fail loudly so the HTTP layer returns a `500` instead of a `202` with a phantom `jobId`
- Add a null-check on `updateJob` return values at all call sites in `video/index.ts`; log a warning when updating a job that no longer exists in Redis

### 2.2 Fix Shot Regeneration Duplicate Clips
**Audit:** #6
**File:** `backend/src/routes/video/index.ts`

- In `runShotRegenerate`, before inserting the new `video_clip` asset, delete the existing asset(s) with the same `generatedContentId`, `userId`, `type: "video_clip"`, and `metadata.shotIndex = shotIndex`
- Use a Drizzle `delete` with a JSON path condition on the `metadata` column

### 2.3 Fix Retry Runner Branch for `shot_regenerate`
**Audit:** #7
**File:** `backend/src/routes/video/index.ts`

- Add an explicit `case "shot_regenerate":` to the `switch` in `getRetryRunner`
- Route it to `runShotRegenerate` with the correct `shotIndex` from `job.request`

### 2.4 Fix Double Job Status Update on Assembly Failure
**Audit:** #5
**File:** `backend/src/routes/video/index.ts`

- In `runAssembleFromExistingClips`'s catch block, either remove the `updateJob` call and let the outer `runReelGeneration` catch handle it, or remove the outer catch's `updateJob` call
- Pick one owner for the failure state transition; the inner catch is closer to the error context and should own it
- Remove the redundant outer update

### 2.5 Fix Assembly Error Handler Wiping Shot Metadata
**Audit:** #10
**File:** `backend/src/routes/video/index.ts`

- In `runAssembleFromExistingClips`'s catch block, refetch the current `generatedMetadata` from DB before calling `updatePhase4Metadata`
- Do not pass `null` as `existingGeneratedMetadata` — pass the freshly fetched value

### 2.6 Fix `sceneDescription` Read Location
**Audit:** #11
**File:** `backend/src/routes/video/index.ts` + schema

**Option A (preferred):** Add `sceneDescription` to the `fetchOwnedContent` select and read it from `content.sceneDescription`

**Option B:** Populate `generatedMetadata.sceneDescription` at insert time in both `content-generator.ts` and `chat-tools.ts`

Option A requires fewer changes and is consistent with the column existing for this purpose.

---

## Phase 3 — Logic Fixes (Correct Behavior)

### 3.1 Fix `loadAuxAudioAssets` to Respect Timeline Asset IDs
**Audit:** #12
**File:** `backend/src/routes/video/index.ts`

- Accept the timeline audio items as a parameter (already available at call sites)
- Query `reelAssets` by the specific `assetId` values in the timeline rather than "most recent"
- Fall back to most-recent only when no `assetId` is set in the timeline

### 3.2 Fix Audio `endMs` in `_buildInitialTimeline`
**Audit:** #13
**File:** `backend/src/routes/video/index.ts`

- Set audio item `endMs` to `asset.durationMs` instead of the total video `durationMs`
- `reelAssets.durationMs` is populated and available from the asset query

### 3.3 Fix `getAssetTypeForTrack` for Video Track Items
**Audit:** #22
**File:** `backend/src/routes/video/index.ts`

- When `track === "video"` and `role` is not set, return `["video_clip"]` instead of falling through to the audio types fallback
- The function currently has a dead branch — handle `"video"` explicitly:

```ts
if (track === "video") return ["video_clip"];
if (role === "voiceover") return ["voiceover"];
if (role === "music") return ["music"];
return ["voiceover", "music"];
```

### 3.4 Fix Queue DELETE Not to Reset Published Content
**Audit:** #19
**File:** `backend/src/routes/queue/index.ts`

- Before resetting `generatedContent.status` to `"draft"`, check the current status
- Only reset if status is `"queued"`; leave `"published"`, `"draft"`, or any other state untouched:

```ts
.where(and(eq(generatedContent.id, item.generatedContentId), eq(generatedContent.status, "queued")))
```

### 3.5 Fix `content-generator.ts` Auto-Enqueue State Desync
**Audit:** #20
**File:** `backend/src/services/reels/content-generator.ts`

- After inserting into `queueItems`, also update `generatedContent.status` to `"queued"` to match the manual queue path

### 3.6 Fix `parseScriptShots` Single-Shot Fallback Gap
**Audit:** #17
**File:** `backend/src/routes/video/utils.ts`

- Instead of throwing for whitespace-only scripts, return `[]` (consistent with the `null` case)
- The outer caller already handles the empty array with a single-shot fallback

### 3.7 Fix `setJobProgress` to Accept Status Parameter
**Audit:** #23
**File:** `backend/src/routes/editor/index.ts`

- Add an optional `status` parameter with default `"rendering"`:

```ts
async function setJobProgress(jobId: string, progress: number, status = "rendering") {
  await db.update(exportJobs).set({ progress, status }).where(...);
}
```

### 3.8 Add Cycle Detection to `createIterateContentTool` Chain Walk
**Audit:** #18
**File:** `backend/src/lib/chat-tools.ts`

- Track visited IDs in a `Set` during the `while(true)` loop
- Break and throw `400 Bad Request` if a cycle is detected
- Add a hard iteration cap (e.g., 50) as a backstop

### 3.9 Auto-Enqueue Iterated Content
**Audit:** #21
**File:** `backend/src/lib/chat-tools.ts`

- After inserting the new version in `createIterateContentTool`, insert into `queueItems` (with `.onConflictDoNothing()`) and update `generatedContent.status` to `"queued"` — matching the `createSaveContentTool` pattern

---

## Phase 4 — Missing Validations

### 4.1 Add Concurrent Job Guard for Reel Generation
**Audit:** #24
**File:** `backend/src/routes/video/index.ts`

- Before calling `videoJobService.createJob`, query Redis (or a DB index) for any existing job for the same `generatedContentId` with status `"queued"` or `"running"`
- Return `409 Conflict` if one exists

### 4.2 Add `shotIndex` Maximum Bound
**Audit:** #25
**File:** `backend/src/routes/video/index.ts`

- Add `.max(99)` (or whatever the maximum supported shot count is) to the `shotIndex` Zod field
- Cross-validate against the actual number of shots in the content's `generatedScript` at runtime

### 4.3 Validate Content Pipeline Phase Before Queuing Video
**Audit:** #26
**File:** `backend/src/routes/video/index.ts`

- After `fetchOwnedContent`, check that `content.generatedScript` is non-null and non-empty
- Return `422 Unprocessable Entity` with a clear message if not ready

### 4.4 Verify `generatedContentId` Ownership on Editor Project Create
**Audit:** #27
**File:** `backend/src/routes/editor/index.ts`

- When `generatedContentId` is provided in `POST /api/editor`, query `generatedContent` with `and(eq(generatedContent.id, generatedContentId), eq(generatedContent.userId, auth.user.id))`
- Return `403` if not found

### 4.5 Add Project Existence Check to Export Status Endpoint
**Audit:** #28
**File:** `backend/src/routes/editor/index.ts`

- At the start of `GET /api/editor/:id/export/status`, verify the project exists and belongs to the user before querying `exportJobs`
- Return `404` for unknown or unowned project IDs

### 4.6 Prevent Duplicate Queue Items
**Audit:** #30
**File:** `backend/src/routes/queue/index.ts`

- Add a unique constraint on `(generatedContentId)` in `queueItems` (or `(userId, generatedContentId)` if cross-user sharing is ever needed)
- Update the manual `POST /api/queue` insert to use `.onConflictDoNothing()` and return a `409` or `200` with the existing item

### 4.7 Add Per-User Export Job Concurrency Limit
**Audit:** #29
**File:** `backend/src/routes/editor/index.ts`

- Before creating a new export job, count active (`rendering`) jobs for the user
- Reject with `429 Too Many Requests` if limit exceeded (suggest starting with limit = 2)

---

## Phase 5 — Architectural Improvements

These require more design work. Do after phases 1–4.

### 5.1 Fix Caption Timing to Use Voiceover Timestamps
**Audit:** #15
**File:** `backend/src/routes/video/index.ts`

- Use word-level timestamps from the TTS response (if available from the provider) to align caption timing with actual speech
- As a fallback, distribute captions proportionally by character count instead of chunk count

### 5.2 Fix `escapeAssText`
**Audit:** #16
**File:** `backend/src/routes/video/index.ts`

- Implement proper ASS/SSA escaping: `{` → `\{`, `}` → `\}`, `\` → `\\`, `\n` → `\N`
- Do not remove braces — escape them

### 5.3 Fix Assembly to Respect Timeline Order
**Audit:** #14
**File:** `backend/src/routes/video/index.ts`

- The `assemble` endpoint should accept a `clipOrder` array of asset IDs
- `runAssembleFromExistingClips` should use this order instead of DB sort order
- This ties in with removing `_validateTimeline` from dead code and actually calling it

### 5.4 Activate `_validateTimeline`
**Audit:** #36
**File:** `backend/src/routes/video/index.ts`

- Remove the `_` prefix and call `validateTimeline` in the `assemble` route handler before enqueuing
- The schema and validation logic are already written; they just aren't wired up

### 5.5 Fix R2 Key/URL Mismatch in Development
**Audit:** #34
**File:** `backend/src/routes/video/index.ts`, `backend/src/services/storage/r2.ts`

- Centralize the `testing/` prefix logic in `r2.ts` — expose a `getKey(rawKey)` helper that applies the prefix
- Use `getKey(assembledR2Key)` everywhere the key is stored or used to construct URLs
- Never construct R2 URLs by hand outside of `r2.ts`

### 5.6 Convert `upsertAssembledAsset` to a Real Upsert
**Audit:** #35
**File:** `backend/src/routes/video/index.ts`

- Use `db.insert(reelAssets).values(...).onConflictDoUpdate(...)` on a unique constraint of `(generatedContentId, userId, type)` for `assembled_video`
- Alternatively, delete the old `assembled_video` asset before inserting the new one

### 5.7 Normalize `outputType` Enum
**Audit:** #37
**Files:** `backend/src/services/reels/content-generator.ts`, `backend/src/lib/chat-tools.ts`, schema

- Decide on one canonical set: recommend `"hook_only" | "caption_only" | "full_script"` (the newer values)
- Migrate old `"hook" | "caption" | "full"` values in the DB via a migration script
- Update `content-generator.ts` to use the new values
- Add a Zod enum in the schema file and use it in both paths

### 5.8 Add `editProjectsRelations` and `exportJobsRelations` to Schema
**Audit:** #39
**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

```ts
export const editProjectsRelations = relations(editProjects, ({ many, one }) => ({
  user: one(users, { fields: [editProjects.userId], references: [users.id] }),
  exportJobs: many(exportJobs),
}));

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  project: one(editProjects, { fields: [exportJobs.editProjectId], references: [editProjects.id] }),
}));
```

Run `bun db:generate` after.

### 5.9 Cap Undo/Redo History
**Audit:** #40
**File:** `frontend/src/features/editor/hooks/useEditorStore.ts`

- Slice `past` to the last N entries (suggest 50) whenever it grows beyond the cap:

```ts
past: [...state.past, state.present].slice(-50),
```

### 5.10 Move `inArray` to Top-Level Import
**Audit:** #38
**File:** `backend/src/routes/editor/index.ts`

- Add `inArray` to the existing `drizzle-orm` import at the top of the file
- Remove the dynamic `await import("drizzle-orm")` inside `runExportJob`

### 5.11 Deduplicate Firebase Token Verification
**Audit:** #33
**File:** `backend/src/middleware/protection.ts`

- `csrfMiddleware` should read the already-verified token from Hono context (set by `authMiddleware`) instead of calling `verifyIdToken` again
- Alternatively, merge CSRF validation into `authMiddleware` so there is only one token verification per request

### 5.12 Add `sourceReelId` to Chat Tools `save_content` Insert
**Audit:** (reels audit)
**File:** `backend/src/lib/chat-tools.ts`

- Populate `sourceReelId` from the available `reelRefs` context when saving content via the chat flow, matching the `content-generator.ts` path

---

## Execution Order

```
Phase 1  ──►  Phase 2  ──►  Phase 3  ──►  Phase 4  ──►  Phase 5
(Security)    (Data Loss)   (Logic)       (Validation)   (Architecture)
  ~2h           ~3h           ~3h           ~2h            ~6h
```

All items within a phase are independent and can be worked in parallel. Phase 5 items are also largely independent of each other.

### Suggested Starting Points

If working solo, tackle in this order:
1. **1.1** (ownership bypass — 15 min, high impact)
2. **2.1** (phantom job IDs — 20 min, high impact)
3. **2.2** (duplicate shot clips — 30 min)
4. **2.3** (retry wrong branch — 15 min)
5. **3.4** (queue delete resets published — 10 min)
6. **4.6** (duplicate queue items — 20 min)
7. **1.2** (tracks validation — 45 min)
8. **1.3** (ffmpeg injection — 30 min)
