# Research: "Open in Editor" — State Not Saved & Overwritten on Re-open

**Date:** 2026-03-25
**Status:** Bug + Feature Request
**Severity:** Critical — user edits are silently destroyed on every re-entry

---

## Problem Summary

When a user clicks **"Open in Editor"** from the chat workspace panel or queue, the editor loads correctly with the right timeline and clips. However:

1. **No save indicator** — the user has no idea whether their changes are being saved.
2. **Edits are destroyed on re-entry** — every time "Open in Editor" is clicked for an already-opened project, the backend overwrites the user's saved tracks with a freshly computed timeline, discarding all edits.
3. **Pending edits are dropped on exit** — if the user made a change within the last 2 seconds before clicking Back, the debounced save timer is cancelled and that edit is silently lost.

---

## Root Cause Analysis

### Bug 1 — Backend `POST /api/editor` Unconditionally Overwrites User Tracks

**File:** `backend/src/routes/editor/index.ts` lines 338–375

When `POST /api/editor` is called with a `generatedContentId` for an existing project, the handler:

1. Calls `buildInitialTimeline(generatedContentId, userId)` — re-reads all assets from the DB and builds a fresh timeline
2. Unconditionally runs `UPDATE edit_projects SET tracks = <fresh>, durationMs = <fresh>`
3. Returns the overwritten project to the frontend

```typescript
// Current broken behavior — existing project branch
if (existing) {
  const { tracks, durationMs } = await buildInitialTimeline(
    generatedContentId,
    auth.user.id,
  );
  // ❌ No check: does the user have edits we should preserve?
  const [updated] = await db
    .update(editProjects)
    .set({ generatedContentId, tracks, durationMs, ...titleUpdate })
    .where(eq(editProjects.id, existing.id))
    .returning();
  return c.json({ project: updated }, 200);
}
```

Every `POST /api/editor` call is treated as "reset to initial state from assets", not "open what the user has already worked on."

### Bug 2 — `EditorPage` Always Fires the Upsert on Mount

**File:** `frontend/src/routes/studio/editor.tsx` lines 83–100

```typescript
useEffect(() => {
  if (contentId && !activeProject && !isOpeningContent) {
    openByContentId(contentId);  // ← always fires POST, always overwrites
  }
}, [contentId]);
```

Every time the user navigates to `/studio/editor?contentId=<N>`, this fires `POST /api/editor`, which triggers the overwrite on the backend.

### Bug 3 — Pending Save Cancelled on Exit

**File:** `frontend/src/features/editor/components/EditorLayout.tsx` lines 257–261

The auto-save uses a 2-second debounce (`EDITOR_AUTOSAVE_DEBOUNCE_MS = 2000`). On unmount, the cleanup clears the timer:

```typescript
return () => {
  clearTimeout(saveTimerRef.current); // ← pending save cancelled
};
```

`flushSave()` exists but is only called on Publish and AI Assemble — never on the "Back" / exit action. Any edit made in the last 2 seconds before exiting is lost.

### What Works Correctly

The auto-save itself is correct. Inside the editor:
- Any track mutation queues a `PATCH /api/editor/:id` after 2 seconds.
- The `PATCH` handler correctly writes whatever tracks it receives — it does not overwrite.
- `isSavingPatch` is already tracked in state (line 182) — it's just not shown in the UI.

The server-side polling + merge logic (`MERGE_TRACKS_FROM_SERVER`) is also correct for incremental asset updates (placeholder → real clip promotion). It correctly preserves locally-modified clips. The problem is entirely in the `POST` upsert path, not the `PATCH` save path.

---

## Full Data Flow (Broken)

```
User clicks "Open in Editor" (VideoWorkspacePanel or queue)
    │
    ▼
Navigate to /studio/editor?contentId=<N>
    │
    ▼
EditorPage mounts → useEffect fires
    │
    ▼
POST /api/editor { generatedContentId: N }
    │
    ▼
Backend: finds existing EditProject for content N
    │
    ▼
buildInitialTimeline(N)  ← reads raw assets, ignores existing tracks
    │
    ▼
UPDATE edit_projects SET tracks = <fresh>, durationMs = <fresh>
    │                    ▲
    │             USER EDITS DESTROYED HERE
    ▼
Returns overwritten project to frontend
    │
    ▼
setActiveProject(res.project) → EditorLayout mounts
    │
    ▼
store.loadProject(overwrittenProject)
    │
    ▼
User sees reset timeline — all edits gone
```

---

## Correct Data Flow (Fixed)

```
User clicks "Open in Editor"
    │
    ▼
Navigate to /studio/editor?contentId=<N>
    │
    ▼
EditorPage: POST /api/editor { generatedContentId: N }
    │
    ▼
Backend: finds existing EditProject
    │
    ├── Has user tracks? (non-empty clips in existing.tracks)
    │       │
    │       ├── YES → skip buildInitialTimeline
    │       │          UPDATE only generatedContentId + title if changed
    │       │          Return existing project WITH user tracks intact ✓
    │       │
    │       └── NO  → buildInitialTimeline (first-time setup)
    │                  Create/update with fresh tracks ✓
    │
    ▼
setActiveProject(project)  ← user's saved state
    │
    ▼
Editor loads with user's edits preserved ✓
```

---

## Proposed Fixes

### Fix 1 — Backend: Preserve Tracks on Re-open (Critical)

**File:** `backend/src/routes/editor/index.ts`

In the existing-project branch, only call `buildInitialTimeline()` if the project has no user content. Otherwise, return the existing project without touching `tracks` or `durationMs`.

```typescript
if (existing) {
  const hasUserTracks =
    Array.isArray(existing.tracks) &&
    (existing.tracks as TrackData[]).some(
      (t) => Array.isArray(t.clips) && t.clips.length > 0,
    );

  if (!hasUserTracks) {
    // First real open — build initial timeline
    const { tracks, durationMs } = await buildInitialTimeline(
      generatedContentId,
      auth.user.id,
    );
    const [updated] = await db
      .update(editProjects)
      .set({ generatedContentId, tracks, durationMs, ...titleUpdate })
      .where(eq(editProjects.id, existing.id))
      .returning();
    return c.json({ project: updated }, 200);
  } else {
    // User has saved edits — preserve them, only update metadata
    const [updated] = await db
      .update(editProjects)
      .set({ generatedContentId, ...titleUpdate })
      .where(eq(editProjects.id, existing.id))
      .returning();
    return c.json({ project: updated }, 200);
  }
}
```

> **Note:** `refreshEditorTimeline()` already exists at `backend/src/routes/editor/services/refresh-editor-timeline.ts` and handles incremental asset promotion (placeholder → real clip) while preserving user edits. If new assets are added to the content after the editor was first opened, `refreshEditorTimeline()` should be called in the `hasUserTracks` branch instead of skipping the update entirely.

---

### Fix 2 — Frontend: Flush Save Before Exiting (Important)

**File:** `frontend/src/features/editor/components/EditorLayout.tsx`

`flushSave()` already exists. Call it in the back/exit handler before unmounting. Since `flushSave` is synchronous (it fires the mutation immediately), this should happen before `onBack()` resolves.

The `onBack` prop call at line ~637 should be wrapped:

```typescript
const handleBack = useCallback(async () => {
  if (!store.state.isReadOnly) {
    flushSave(); // fire any pending debounced save immediately
  }
  onBack();
}, [store.state.isReadOnly, flushSave, onBack]);
```

Replace the current `onBack()` button `onClick` with `handleBack`.

---

### Fix 3 — UI: Save Status Indicator (Feature Request)

**File:** `frontend/src/features/editor/components/EditorLayout.tsx` (toolbar area)

`isSavingPatch` is already in state at line 182. Use it to render a small status badge in the editor toolbar.

States to display:
- **Unsaved changes** (`isDirty && !isSavingPatch && !lastSavedAt`) — show "Unsaved changes"
- **Saving...** (`isSavingPatch`) — show "Saving..." with a spinner
- **Saved** (`lastSavedAt && !isSavingPatch`) — show "Saved [time]" (e.g., "Saved just now")

Implementation sketch:

```typescript
// Track when the last successful save completed
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

// In the patchProject mutation's onSuccess:
onSuccess: () => {
  setLastSavedAt(new Date());
  // ... existing invalidation logic
}

// In toolbar JSX:
<SaveStatusBadge
  isSaving={isSavingPatch}
  lastSavedAt={lastSavedAt}
  isDirty={store.state.isDirty}
/>
```

A `SaveStatusBadge` component can live at `frontend/src/features/editor/components/SaveStatusBadge.tsx`.

---

## Files to Change

| File | Change |
|---|---|
| `backend/src/routes/editor/index.ts` (lines 338–375) | Fix upsert: preserve tracks when project already has user content |
| `frontend/src/features/editor/components/EditorLayout.tsx` (lines 636–641) | Flush save before calling `onBack` |
| `frontend/src/features/editor/components/EditorLayout.tsx` (toolbar) | Add `SaveStatusBadge` to toolbar |
| `frontend/src/features/editor/components/SaveStatusBadge.tsx` | New component: Saving / Saved / Unsaved indicator |
| `frontend/src/features/editor/hooks/useEditorStore.ts` (optional) | Add `isDirty` flag to state if not already tracked |

---

## Testing Plan

1. **Open in Editor for the first time** → should build and display a fresh timeline (unchanged behavior).
2. **Make edits, wait for auto-save** → "Saved" indicator appears. Exit. Re-open via "Open in Editor" → timeline should be exactly as left.
3. **Make edits, immediately click Back** (within 2 seconds) → `flushSave` fires immediately → re-open shows the last edit.
4. **Open from queue → make edits → open from chat → same project** → edits preserved.
5. **Save indicator** → changes show "Unsaved changes", spinner during save, "Saved just now" after.

---

## Priority

| Issue | Impact | Effort |
|---|---|---|
| Fix 1: Backend overwrite | Critical — all user work silently lost | Low (5–10 lines) |
| Fix 2: Flush save on exit | High — last-second edits lost | Low (3–5 lines) |
| Fix 3: Save indicator | Medium — confusing UX without feedback | Medium (new component) |

Fix 1 is a one-liner conditional check. It should ship first as a hotfix before the UI work.
