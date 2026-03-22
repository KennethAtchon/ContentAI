# Red Team Report: `06-unified-backend-data-layer-hld-lld.md`

**Artifact type:** Architecture / HLD + LLD
**Scope reviewed:** All 10 phases + HLD design decisions, verified against actual codebase
**Total findings:** 15 (🔴 0 critical · 🟠 4 high · 🟡 6 medium · 🔵 4 low · ⚪ 1 info)

---

## Findings

### 🟠 HIGH — Clip ordering regression: `shotIndex` vs `createdAt` — `Phase 1 / build-initial-timeline.ts`

**What:** `_buildInitialTimeline` (video route, line 1026) sorts video clips by `metadata.shotIndex` — an explicit integer written by the pipeline to record intended clip order. `buildInitialTimeline` (editor service, line 52) sorts by `assets.createdAt`. These are not equivalent.

**Why it matters:** AI-generated shots are inserted into the `assets` table as they complete, not necessarily in `shotIndex` order — generation is async and parallel. After migration, assembling a reel will silently produce a timeline with clips in creation-time order rather than shot-order. The user sees a shuffled timeline with no error.

**Proof:** `loadShotAssets` (video/index.ts:1026) does `.sort((a, b) => shotIndex_a - shotIndex_b)`. `buildInitialTimeline` does `.orderBy(assets.createdAt)`. For any content where assets were committed out of shot order, these produce different clip sequences.

**Fix direction:** Add `metadata` to the fields selected in `buildInitialTimeline` and apply the same `shotIndex` sort that `loadShotAssets` uses, or add an explicit `sortOrder` column to `content_asset` that the editor service can rely on without parsing JSONB metadata.

---

### 🟠 HIGH — `buildInitialTimeline` includes `final_video` and `image` assets; old function did not — `Phase 1 / build-initial-timeline.ts`

**What:** The doc asserts `buildInitialTimeline` is "the authoritative implementation" and `_buildInitialTimeline` is a "subset." This is inaccurate. The editor service version is a **superset** that also includes:
- `role === "final_video"` assets (the previously assembled video) in the video track
- `role === "image"` assets appended to the video track after clips

Neither of these asset types were included by `_buildInitialTimeline`. The plan also proposes adding `assembled_video` to the filter (Phase 1 LLD, line ~260).

**Why it matters:** On first assembly, a content item that has a `final_video` asset (from a prior FFmpeg assembly run on the legacy path) will now have that assembled video dropped into the video track alongside individual clips. The user sees a video-track timeline containing both the raw clips AND the already-assembled result. This is a data correctness bug, not a display glitch — the export path will render both.

**Proof:** `buildInitialTimeline:54–56` — `role === "video_clip" || role === "final_video"` are both added to `videoClipAssets`. `loadShotAssets:1022` — `eq(contentAssets.role, "video_clip")` only.

**Fix direction:** Phase 1 must explicitly decide which asset roles belong in the initial timeline and document the decision. For the migration window while `?legacy=true` still exists, `final_video` and `assembled_video` should be excluded from the initial editor timeline, or included only if no `video_clip` assets exist.

---

### 🟠 HIGH — Phase 2 race condition acknowledged but LLD provides no actual fix — `Phase 2, assemble handler`

**What:** The doc correctly identifies the race condition: two concurrent first-assembly requests both pass the SELECT check before either INSERT completes. Both attempt to INSERT, and the second hits the unique-constraint violation returning a raw 500. The edge-cases section says "handle with an upsert or retry-fetch pattern" but the actual LLD code block does not include this handling.

**Why it matters:** This is a timing-sensitive path. Mobile clients with unreliable connections routinely retry on tap. Two quick taps on "Assemble" will trigger this. The result is a 500 error on the second request, which is presented to the user as a failure even though the operation succeeded.

**Fix direction:** Change the `db.insert(editProjects)` to use Drizzle's `.onConflictDoNothing()` and follow up with a SELECT if no row was returned, or wrap the SELECT + INSERT in a serializable transaction. The fix should be shown in the LLD code block, not deferred to an edge-case note.

---

### 🟠 HIGH — Phase 2 assemble handler SELECT has no `parentProjectId IS NULL` filter; will break when Phase 8 ships — `Phase 2 vs Phase 8 interaction`

**What:** The assemble handler's existence check (video/index.ts:1946–1955):
```typescript
.where(
  and(
    eq(editProjects.userId, auth.user.id),
    eq(editProjects.generatedContentId, payload.generatedContentId),
  ),
)
```
has no `AND parentProjectId IS NULL` filter. Phase 8 introduces snapshot rows that share the same `(userId, generatedContentId)`. After Phase 8 ships, this SELECT may match a snapshot row and return a snapshot's `id` as the `editorProjectId` — directing the frontend to open a read-only historical version as though it were the live editor.

**Why it matters:** The Phase 2 code is in PR 1, Phase 8 is in PR 3. The fix is never mentioned in either phase's LLD. This is a cross-PR dependency that will silently corrupt navigation after PR 3 merges.

**Fix direction:** Add `isNull(editProjects.parentProjectId)` to the WHERE clause in Phase 2's LLD code, even though it has no effect until Phase 8. Calling this out explicitly prevents the regression.

---

### 🟡 MEDIUM — Phase 6 and Phase 10 perform multi-step DB writes without a transaction — `Phase 6 export handler / Phase 10 link-content`

**What:** Both Phase 6 (auto-create `generated_content` on first export) and Phase 10 (`POST /api/editor/:id/link-content`) perform 3 sequential DB writes:
1. `INSERT generated_content`
2. `INSERT queue_item` / `UPDATE edit_project.generatedContentId`
3. `UPDATE edit_project` / `INSERT queue_item`

None are wrapped in a transaction.

**Why it matters:** If the server crashes or the DB rejects step 2 or 3, the system is left with an orphaned `generated_content` row (no linked `edit_project`, no `queue_item`) or a `queue_item` pointing to a `generated_content` with no `edit_project`. Both states are invisible to the user and corrupt pipeline visibility. Phase 6 explicitly notes the concurrent INSERT issue but the recommended mitigation (`UPDATE ... WHERE generated_content_id IS NULL RETURNING`) only solves one of the three writes — it still leaves the `queue_item` INSERT unprotected.

**Fix direction:** Wrap each multi-step block in `db.transaction(async (tx) => { ... })` using Drizzle's transaction API. All three writes must commit atomically or not at all.

---

### 🟡 MEDIUM — `durationMs` clamping removed silently — `Phase 1 / build-initial-timeline.ts`

**What:** `_buildInitialTimeline:457` clamps the total duration: `Math.min(Math.max(cursor, 1000), 180_000)` — minimum 1 second, maximum 3 minutes. `buildInitialTimeline:100` uses `const totalDuration = videoPosition` with no clamping. If a content item has no video clips (`videoPosition === 0`), `durationMs` is 0. Audio clips are then created with `durationMs: asset.durationMs ?? 0` (voiceover) and `durationMs: asset.durationMs ?? 0` (music). A 0-duration track is a degenerate state.

**Why it matters:** The doc adds a `durationMs === 0` check in Phase 1's edge cases and says to return 422 "No assets ready." But that check is only in the assemble handler. `POST /api/editor` (create project) also calls `buildInitialTimeline` directly (currently), and that path has no such guard. A blank or asset-less project created via the editor route will get a `durationMs: 0` project that behaves unexpectedly in the editor.

**Fix direction:** Apply the same clamp in `buildInitialTimeline` or add a minimum of `durationMs: 1000` as a post-computation step. Alternatively, clarify that the `durationMs === 0` guard lives in every caller.

---

### 🟡 MEDIUM — Phase 5 LEFT JOIN produces duplicate queue rows after Phase 8 — `Phase 5 LLD / queue GET handler`

**What:** The Phase 5 LEFT JOIN condition:
```typescript
.leftJoin(
  editProjects,
  and(
    eq(editProjects.generatedContentId, queueItems.generatedContentId),
    eq(editProjects.userId, queueItems.userId),
  ),
)
```
has no `AND parentProjectId IS NULL` filter. Phase 8 creates snapshot rows with the same `(userId, generatedContentId)`. After Phase 8, a content item with 3 snapshots + 1 root will match 4 `edit_project` rows in this JOIN, causing 4 output rows per queue item. Counts and pagination will be wrong, and the frontend will render duplicate pipeline cards.

**Why it matters:** This is a Phase 5 → Phase 8 dependency gap. Phase 5 ships in PR 2, Phase 8 in PR 3. The edge-cases section of Phase 5 mentions this and says "add `AND edit_projects.parent_project_id IS NULL`" — but that fix is not in the LLD code block. A developer implementing Phase 5 from the LLD code will write the broken JOIN.

**Fix direction:** Add `isNull(editProjects.parentProjectId)` to the Phase 5 JOIN condition in the LLD code block, not just in the edge-cases text.

---

### 🟡 MEDIUM — Phase 8 snapshot inherits `status: root.status` — `Phase 8 fork endpoint`

**What:** The Phase 8 `POST /api/editor/:id/fork` INSERT copies all root fields including `status: root.status`. If the root project is `"published"`, the snapshot is also created as `"published"`.

**Why it matters:** Snapshots are meant to be historical read-only copies, not published state. A "published" snapshot could be matched by any query that filters `WHERE status = 'published'` — for instance, if the gallery or queue ever adds a "show only published" filter. The queue's `editProjectStatus` logic in Phase 5 maps `"published"` → `"ok"` for the edit stage; a published snapshot matching the JOIN would incorrectly show the edit stage as "ok" even if the root project has since been reset to draft.

**Fix direction:** Hardcode `status: "draft"` in the snapshot INSERT. Snapshots should never inherit the published state.

---

### 🟡 MEDIUM — `restore-from/:snapshotId` is in the API contract but has no LLD implementation — `Phase 8`

**What:** Phase 8 lists `PUT /api/editor/:id/restore-from/:snapshotId → { ok: true }` in the API contract additions table but the LLD section contains no implementation code for this endpoint. The version history panel mentions calling it for the "Reset to this version" action, but the handler doesn't exist in the doc.

**Why it matters:** This is an incomplete spec. A developer implementing Phase 8 will write `POST /fork` and `GET /versions` but miss the restore endpoint entirely, leaving the version history panel with no way to actually restore a snapshot.

**Fix direction:** Add a `PUT /:id/restore-from/:snapshotId` handler to the Phase 8 LLD. It should: (1) verify ownership of both IDs, (2) fork the root to a new snapshot (preserving the current state), (3) copy the target snapshot's `tracks` and `durationMs` onto the root.

---

### 🔵 LOW — Phase 5 correlated subqueries use hardcoded SQL table names — `Phase 5 / queue GET handler`

**What:** The three correlated subqueries for `latestExportJobId`, `latestExportStatus`, `latestExportUrl` use raw SQL strings with hardcoded table names: `FROM export_job` and `FROM asset a`. These are correct today (verified: `pgTable("export_job", ...)`, `pgTable("asset", ...)`), but they bypass Drizzle's type system. If either table is renamed in the Drizzle schema, the raw SQL won't error at build time — it fails silently at runtime.

**Fix direction:** Consider replacing with a proper Drizzle subquery using the `sq` alias pattern (`db.select(...).from(exportJobs).where(...).as("sq")`), which is type-safe. If correlated SQL is kept, add a comment noting the hardcoded table names so a future rename doesn't miss them.

---

### 🔵 LOW — `captions` track type dropped from initial timeline — `Phase 1 / build-initial-timeline.ts`

**What:** `_buildInitialTimeline` produces a `TimelinePayload` with four track types: `video`, `audio`, `text`, `captions`. `buildInitialTimeline` (editor service) produces: `video`, `audio`, `music`, `text` — no `captions` track. The doc states captions are handled separately, but doesn't specify how an existing `captions` asset (role `"caption"`) would be placed in the initial timeline after migration.

**Why it matters:** If any existing content items have caption assets attached via `content_asset`, they will not appear in the initial timeline generated by the new function. The plan mentions captions in the system context diagram but never in the Phase 1 asset role list.

**Fix direction:** Explicitly confirm that caption assets are excluded from the initial timeline (loaded separately via the captions API) and document this decision. If captions should be included, add a `captions` track to `buildInitialTimeline`.

---

### 🔵 LOW — `trimEndMs: 0` is inconsistent with converter's `trimEndMs: clip.durationMs` — `Phase 1`

**What:** `makeClip` in `buildInitialTimeline` sets `trimEndMs: 0`. `_convertTimelineToEditorTracks` sets `trimEndMs: item.endMs - item.startMs` (equals the full clip duration). The export renderer uses `clip.durationMs` for rendering (not `trimEndMs`), so this is not a current runtime bug. However, `convertAIResponseToTracks` (editor/index.ts:1164) computes `clipDuration = cut.trimEndMs - cut.trimStartMs` and would produce `0ms` clips if called on tracks from `buildInitialTimeline`. The schema allows `trimEndMs: 0` (`min(0)`) so no validation catches it.

**Why it matters:** `trimEndMs: 0` means "trim the entire clip" in the semantic model used by `convertAIResponseToTracks`. Any future code that adopts that semantic will silently produce zero-duration clips from editor-service-created timelines.

**Fix direction:** Set `trimEndMs: asset.durationMs ?? 5000` (same as `durationMs`) in `makeClip` to be consistent with the established convention.

---

### 🔵 LOW — `audioMix` phase description contradicts LLD code — `Phase 2 / Phase 1 notes`

**What:** Phase 1 edge-cases section says: "The `audioMix` input field on the `assembleSchema` should be retained for future use but **may be ignored for now**; or you can apply `audioMix` volumes as a post-processing step." Phase 2 LLD then immediately shows `applyAudioMix` being called in the assembly handler. The "may be ignored" option is not actually an option — the LLD code uses it. This contradiction could cause a developer to skip implementing `applyAudioMix` when following Phase 1.

**Fix direction:** Remove the "may be ignored" language from Phase 1 and replace with a forward reference: "Phase 2 applies `audioMix` as a post-processing step via `applyAudioMix`."

---

### ⚪ INFO — Phase 4 removes localStorage but adds no server-side job recovery on mount — `Phase 4`

**What:** Phase 4 removes the localStorage persistence for `videoJobId`. The doc explicitly acknowledges: "If the user reloads the page, `videoJobId` resets to `null`. The job continues running on the server. The user will not see the progress toast." This is labeled an "acceptable trade-off."

**Why it deserves acknowledgment:** The localStorage pattern exists specifically because in-flight jobs can outlive the component's mount lifecycle. Removing it without the recovery mechanism (`query server for latest job by generatedContentId on mount`) is a net UX regression, not a neutral refactor. The user loses live feedback for a generation that may take several minutes. The doc notes this could be added as a "future enhancement" — it should be scheduled in a specific subsequent PR rather than left open-ended.

---

## Summary

**Top 3 risks to address immediately:**

1. **Clip ordering regression (HIGH):** `buildInitialTimeline` sorts by `createdAt` but `_buildInitialTimeline` sorted by `shotIndex`. After migration, AI-generated reels will have clips in the wrong order for any content where assets were persisted out of shot sequence. This will silently corrupt the timeline on every first assembly.

2. **Phase 2 assemble handler will return snapshot IDs after Phase 8 ships (HIGH):** The existence check has no `parentProjectId IS NULL` guard. Once snapshots exist, the handler can return a snapshot's ID as the working editor project. This cross-PR regression is not called out in either Phase 2 or Phase 8's LLD and will only be discovered in production after PR 3 merges.

3. **Multi-step writes without transactions in Phase 6 and Phase 10 (MEDIUM):** Three-step DB operations (INSERT + INSERT + UPDATE) without atomic wrappers. A partial failure leaves orphaned `generated_content` rows silently disconnected from their projects and queue items.

**Patterns observed:**

The cross-phase dependency management is the recurring structural weakness. Several phases introduce assumptions (Phase 2's existence check, Phase 5's JOIN) that are correct today but will break when a later phase ships. The fixes are mentioned in edge-cases sections but are not in the LLD code blocks, meaning they will be missed by an implementer following the doc literally. The PR groupings (PR 1 / PR 2 / PR 3) make this worse: PR 1 and PR 2 ship code that is silently broken by PR 3.

The behavioral differences between the old and new timeline builders are also systematically underestimated. The doc frames `buildInitialTimeline` as strictly better (authoritative, no conversion step), but the actual code comparison shows meaningful differences in sort order, asset role scope, and duration handling that could produce different output for existing content.

**What's actually solid:**

The "editor is source of truth" invariant (Phase 2 create-only contract) is the right architectural decision and is well-reasoned. The fork/snapshot model (Phase 8) is clean and the partial unique index change is the correct mechanism. The PR groupings match the dependency graph well for independent shippability.
