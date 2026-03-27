# Editor Save / Load Bugs — Deep Dive

**Date:** 2026-03-27
**Severity:** Critical — user edits are silently lost on every page refresh

---

## TL;DR

The editor has working auto-save (PATCH to DB), but every single time the user opens the editor via
"Open in Editor" the backend runs `refreshEditorTimeline()` which **re-writes the DB** with a
re-merged copy of the tracks. This merge resets all video clip positions to a tight end-to-end
sequence starting at 0ms, and replaces voiceover and music clips entirely. The saves are real, but
they get overwritten by the next open.

---

## Architecture Recap

```
User opens /studio/editor?contentId=X
  └─ EditorPage.useEffect fires
       └─ POST /api/editor { generatedContentId: X }
            ├─ project exists AND hasUserTracks=true
            │    └─ refreshEditorTimeline(contentId)   ← WRITES to DB
            │         └─ returns refreshed project
            ├─ project exists AND hasUserTracks=false
            │    └─ buildInitialTimeline(contentId)    ← WRITES to DB (full reset)
            │         └─ returns rebuilt project
            └─ project doesn't exist → create new
```

```
User edits clips in EditorLayout
  └─ tracks change → useEffect (line 406) → scheduleSave() → 2s debounce
       └─ PATCH /api/editor/:id { tracks, durationMs, title }   ← partial update
            └─ DB updated, returns { id, updatedAt }
```

The problem is these two paths conflict: PATCH saves the user's work correctly, but the next
`POST /api/editor` (triggered on every page open) calls `refreshEditorTimeline()` which overwrites
the tracks again.

---

## Bug 1 — `reconcileVideoClipsWithoutPlaceholders` resets all clip positions to 0

**File:** `backend/src/routes/editor/services/refresh-editor-timeline.ts:111–185`

```typescript
export function reconcileVideoClipsWithoutPlaceholders(
  existingClips: TimelineClipJson[],
  videoPool: AssetMergeRow[],
): TimelineClipJson[] {
  let cursor = 0;
  return clips.map((c) => {
    const dur = ...;
    const next = { ...c, startMs: cursor };  // ← ALWAYS resets to cursor
    cursor += dur;
    return next;
  });
}
```

This function builds a **new tight end-to-end sequence** from scratch, using `cursor` as the
running offset. It does NOT preserve the user's `startMs` values.

**Impact:** Every time "Open in Editor" is clicked:
- All video clip positions are reset to `0, dur1, dur1+dur2, ...`
- Any gaps the user created are removed
- Any clips the user repositioned snap back
- The user's saved PATCH data is immediately overwritten back to the packed sequence

**Fix:** Preserve existing `startMs` when the assetId matches and no structural reorder is needed.
Only re-sequence when a new asset was added to the pool (new clip or shotIndex changed).

---

## Bug 2 — `refreshEditorTimeline` unconditionally replaces voiceover and music clips

**File:** `backend/src/routes/editor/services/refresh-editor-timeline.ts:267–331`

```typescript
if (track.type === "audio") {
  if (!voiceover) return track;
  const nonVoiceoverClips = track.clips.filter(
    (c) => !c.id.startsWith("voiceover-"),
  );
  // Always inserts fresh voiceover clip at startMs: 0
  return {
    ...track,
    clips: [
      ...nonVoiceoverClips,
      { id: `voiceover-${voiceover.id}`, startMs: 0, durationMs: dur, ... },
    ],
  };
}
```

Same pattern for music. The voiceover/music clip is rebuilt from scratch with `startMs: 0` and
the raw `durationMs` from the asset.

**Impact:** Every "Open in Editor" call:
- Resets voiceover position to `startMs: 0` (ignoring user's saved offset)
- Resets voiceover duration to the raw asset duration (ignoring user's trim)
- Resets music `volume: 0.3` (ignoring user's saved volume)
- Saves this back to the DB, overwriting the user's PATCH

**Fix:** Compare the voiceover assetId against the existing clip's `assetId`. If they are the
same asset, do NOT replace the clip — only update the `assetId` reference if the underlying asset
changed (e.g. voiceover was regenerated). Preserve `startMs`, `trimStartMs`, `trimEndMs`,
`volume` from the existing clip.

---

## Bug 3 — `hasUserTracks` check treats "all clips deleted" as "never edited"

**File:** `backend/src/routes/editor/index.ts:374–391`

```typescript
const hasUserTracks =
  Array.isArray(existingTracks) &&
  existingTracks.some(
    (t) => Array.isArray(t.clips) && t.clips.length > 0,
  );

if (!hasUserTracks) {
  // Full buildInitialTimeline — completely overwrites everything
  const { tracks, durationMs } = await buildInitialTimeline(...);
  await db.update(editProjects).set({ tracks, durationMs, ... });
  return c.json({ project: updated }, 200);
}
```

`hasUserTracks` is `false` whenever all tracks are empty — including when the user intentionally
deleted all clips. The condition cannot distinguish "project just created, never edited" from
"user cleared all clips deliberately".

**Scenario that triggers it:**
1. User opens editor — initial clips load
2. User deletes all video clips → PATCH saves empty tracks to DB
3. User navigates away
4. User opens editor again
5. `hasUserTracks = false` → `buildInitialTimeline()` runs → full reset

**Fix:** Track user intent separately. Add a `userHasEdited: boolean` column (or use `updatedAt`
comparison against `createdAt`) to mark that the user has actively touched this project.
Set `userHasEdited = true` on any PATCH request. Use that flag instead of checking clip count.

---

## Bug 4 — `POST /api/editor` runs on every single page open, even when nothing changed

**File:** `frontend/src/routes/studio/editor.tsx:96–100`

```typescript
useEffect(() => {
  if (contentId && !activeProject && !isOpeningContent) {
    openByContentId(contentId);
  }
}, [contentId]);
```

`activeProject` is React state — it is `null` on every cold page load (refresh, direct URL
open, navigating back). So this `useEffect` fires and hits `POST /api/editor` on every single
visit, unconditionally triggering `refreshEditorTimeline` and a DB write.

**Impact:**
- User refreshes the editor → all position edits reset to packed sequence (Bug 1)
- DB is written on every open even if nothing changed in the content assets
- Creates a race condition with in-flight auto-saves

**Fix:** If a project with this `contentId` already exists in the projects list (already fetched
via `GET /api/editor`), open it directly without hitting `POST`. Only call `POST /api/editor` the
first time (project doesn't exist yet) or when the user explicitly requests a timeline rebuild.

```typescript
// Pseudocode fix
useEffect(() => {
  if (!contentId || activeProject || isOpeningContent) return;
  const existing = projects.find(p => p.generatedContentId === contentId);
  if (existing) {
    setActiveProject(existing); // no POST, no DB write
  } else {
    openByContentId(contentId); // first time only
  }
}, [contentId, projects]);
```

---

## Bug 5 — Auto-save timer is cancelled on unmount — edits within the last 2s are lost

**File:** `frontend/src/features/editor/components/EditorLayout.tsx:275–279`

```typescript
useEffect(() => {
  return () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);  // cancels on unmount
  };
}, []);
```

The debounce cleanup cancels any in-flight 2-second timer when the component unmounts
(user navigates away). If the user makes a change and leaves within 2 seconds, that change is
never saved.

**Secondary effect:** The 30-second heartbeat save also stops on unmount — but the last debounced
save may not have fired yet.

**Fix:** On unmount, flush the save immediately rather than cancelling it:

```typescript
useEffect(() => {
  return () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      // Flush synchronously — fire the PATCH before component tears down
      flushSave({ tracks: ..., durationMs: ..., title: ... });
    }
  };
}, []);
```

Note: `flushSave` is a `mutateAsync`, which is async — calling it synchronously in a cleanup
function may not complete before the browser navigates. A better approach is to use the
[Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) or
`navigator.sendBeacon` for last-chance saves.

---

## Bug 6 — `refreshEditorTimeline` is called from `POST /api/editor` AND from the video generation pipeline (potential double-write)

**File:** `backend/src/routes/editor/index.ts:399` (called from POST route)
**Also called from:** video generation completion handlers (asset creation webhooks/jobs)

`refreshEditorTimeline` runs inside a transaction with a `FOR UPDATE` row lock — that's correct.
But the timing between the user auto-save PATCH and the background `refreshEditorTimeline` call
is not guarded:

```
Timeline:
T=0    User edits clip position → PATCH fires (partial update)
T=0.1  PATCH completes, DB has user's positions
T=0.5  Video generation completes → refreshEditorTimeline() fires
T=0.6  refreshEditorTimeline reads T=0.1 state, resequences, writes T=0 positions back
T=0.7  User's position edit is silently overwritten
```

**Fix:** `refreshEditorTimeline` should not reorder clips that have no structural change
(Bug 1 fix covers this). Additionally, the function should compare the incoming asset IDs
against existing clip `assetId` fields and skip the merge entirely if no new assets were added.

---

## Bug Summary Table

| # | Bug | Where | Severity | User Impact |
|---|-----|--------|----------|-------------|
| 1 | `reconcileVideoClipsWithoutPlaceholders` resets all `startMs` to tight sequence | `refresh-editor-timeline.ts:111` | Critical | All clip positions reset on every open |
| 2 | `refreshEditorTimeline` unconditionally replaces voiceover/music clips | `refresh-editor-timeline.ts:267` | High | Audio trim, position, volume lost on every open |
| 3 | `hasUserTracks` check causes full rebuild when user deletes all clips | `editor/index.ts:374` | High | Deliberately empty timeline resets to AI-generated content |
| 4 | `POST /api/editor` fires on every cold page load, triggering refresh | `editor.tsx:96` | Critical | Every refresh overwrites user positions |
| 5 | Auto-save timer cancelled on unmount — last ~2s of edits lost | `EditorLayout.tsx:275` | Medium | Fast edit-then-navigate loses changes |
| 6 | `refreshEditorTimeline` can race with in-flight PATCH saves | `refresh-editor-timeline.ts:341` | Medium | Race condition in concurrent edits + generation |

---

## Correct Intended Behavior

| Scenario | Expected | Actual |
|----------|----------|--------|
| Refresh editor page | Load last saved state from DB unchanged | Triggers refresh, resets clip positions |
| Open editor after "Generate Clips" (first time) | Build initial timeline | Works correctly |
| Open editor after "Generate Clips" (project exists, new assets only) | Merge NEW assets into existing user-edited timeline, preserve all positions | Resequences everything from 0 |
| Open editor after "Generate Clips" (same assets, no change) | Do nothing — load project as saved | Still rewrites DB |
| User deletes all clips, saves, reopens | Empty timeline | Full rebuild from AI content |
| User moves voiceover start, saves, reopens | Voiceover at user's position | Reset to startMs=0 |

---

## Recommended Fix Order

1. **Bug 4 first** — stop calling `POST /api/editor` when the project already exists locally.
   This alone would eliminate most user-visible data loss.

2. **Bug 1** — fix `reconcileVideoClipsWithoutPlaceholders` to preserve existing `startMs` when
   the asset hasn't changed structurally.

3. **Bug 2** — fix `mergePlaceholdersWithRealClips` audio/music branch to preserve existing
   clip fields when assetId hasn't changed.

4. **Bug 3** — add `userHasEdited` flag to the schema, set it on every PATCH, use it instead
   of clip count for the rebuild guard.

5. **Bug 5** — replace timer cancellation on unmount with a flush or beacon-based save.

6. **Bug 6** — add an early exit to `refreshEditorTimeline` when the asset set is identical
   to what's already in the tracks (no-op if nothing changed).

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/routes/studio/editor.tsx` | Check project list before calling POST; open directly if found |
| `backend/src/routes/editor/services/refresh-editor-timeline.ts` | Preserve `startMs`/trim/volume when assetId matches; add no-op early exit |
| `backend/src/routes/editor/index.ts` | Replace `hasUserTracks` with `userHasEdited` flag |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `userHasEdited boolean default false` to `editProjects` |
| `frontend/src/features/editor/components/EditorLayout.tsx` | Flush save on unmount instead of cancelling |
