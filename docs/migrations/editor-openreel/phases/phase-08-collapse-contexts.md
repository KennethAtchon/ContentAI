# Phase 8 — Collapse Context Sprawl

> Reduce the 9-nested React context tree to ≤ 3 providers. Move domain state into focused stores with `useSyncExternalStore` selectors so components only re-render when their specific slice changes.
> After this phase: editing UI is responsive, inspector interactions don't shake the tree.

## Goal

1. Replace `EditorDocumentStateContext`, `EditorDocumentActionsContext`, `EditorClipCommandsContext`, `EditorSelectionContext`, `EditorUIContext`, `EditorPersistContext`, `EditorPlaybackContext`, `AssetUrlMapContext`, `PlayheadClockContext` with:
   - `useTimelineStore` (Zustand, already conceptually present via reducer) — tracks, subtitles, captionDoc, project meta, actions
   - `useUIStore` (Zustand) — selection, zoom, panel visibility, dialog state
   - `useEngineStore` (Zustand, from phase 2) — engine handles
2. At most 1 provider — a root `<EditorRoot>` that initializes engine + stores on mount. Possibly zero if stores are truly static.
3. All reads happen via store selectors, not `useContext`. No monolithic context values.

## Preconditions

- Phase 3 merged (playback state already out of context).
- Phase 4 merged (rendering decoupled).
- Phase 6 merged (captions decoupled).

## Files Touched

### Implement
- `frontend/src/features/editor/stores/timelineStore.ts` — Zustand store for tracks/subtitles/caption/meta. Wraps the existing reducer OR replaces it (see §Design choice below).
- `frontend/src/features/editor/stores/uiStore.ts` — Zustand store for selection, zoom, dialogs.

### Modify
- `frontend/src/features/editor/components/layout/EditorProviders.tsx` — drop almost all providers; just mount `<EditorRoot>` that kicks off `engineStore.initialize()` and hydrates `timelineStore` from the initial project.
- Every component under `features/editor/components/` that uses `useContext(EditorDocumentStateContext)` etc. — switch to `useTimelineStore(selector)`.
- Every hook under `features/editor/hooks/` that reads contexts — switch to stores.

### Delete
- All files under `frontend/src/features/editor/context/` **except** `PlayheadClockContext.tsx` if still needed (the clock is already in `engineStore`; this context is likely redundant after phase 3).
- `EditorClipCommandsContext`, `EditorDocumentActionsContext` — these were workarounds for the sprawling props. The store replaces them.

### Decide
- `frontend/src/features/editor/model/editor-reducer.ts` + splits (`editor-reducer-clip-ops.ts`, etc.) — keep the reducer logic. It's a pure function `(state, action) → state`. Wrap it in Zustand:
  ```ts
  const useTimelineStore = create<TimelineState>((set) => ({
    ...initialState,
    dispatch(action: EditorAction) {
      set((s) => editorReducer(s, action));
    },
  }));
  ```
  Undo/redo continues via the action stack. No logic change.

## Design Choice: Zustand vs native `useSyncExternalStore`

Both work. Recommendation: **Zustand**. Reasons:
- You already have it as a transitive dep (TanStack Query uses it). If not, small add.
- `subscribeWithSelector` middleware gives you surgical subscriptions out of the box.
- Matches OpenReel's pattern exactly.
- DevTools middleware for free action logging during migration.

Bun-compatible, no SSR concerns. Add if not present: `bun add zustand`.

## Selector Pattern Rules

1. Every `useTimelineStore` call takes a selector: `useTimelineStore((s) => s.tracks)`.
2. Never `useTimelineStore()` without a selector in a component (subscribes to every change).
3. Derived selectors memoized via `zustand/shallow` when returning objects/arrays:
   ```ts
   const { clipId, startMs } = useTimelineStore(
     (s) => ({ clipId: s.selection.clipId, startMs: s.selection.startMs }),
     shallow,
   );
   ```
4. Actions pulled once: `const addClip = useTimelineStore((s) => s.addClip);` — actions are stable.

## File-by-File Sweep Plan

Walk the tree once:

```
frontend/src/features/editor/
  components/
    caption/        — replace useContext imports with store selectors
    dialogs/        — same
    inspector/      — same (heavy context usage today)
    layout/         — rewrite EditorProviders, EditorRoot
    panels/         — same
    preview/        — already mostly migrated in phase 4
    timeline/       — heavy usage; careful
  hooks/
    useEditorClipActions.ts    — move to timelineStore actions
    useEditorKeyboard.ts       — uses keystroke → store.dispatch
    useEditorLayoutMutations.ts — wrap in store
    useEditorProjectPoll.ts    — keep; calls store.hydrate on response
    useEditorStore.ts          — becomes just `useTimelineStore` re-export or delete
    useEditorTransport.ts      — calls playbackBridge
    useEditorAutosave.ts       — subscribes to timelineStore changes
    useEditorAssetMap.ts       — now a store, not a hook
```

For each file, the change is:
```diff
- const { tracks } = useContext(EditorDocumentStateContext);
+ const tracks = useTimelineStore((s) => s.tracks);
```

## Step-by-Step

1. Branch `migration/phase-08-contexts`.
2. **Commit 1: create `timelineStore`.** Wrap existing reducer. Hydrate on project load. Add shallow-memo helpers.
3. **Commit 2: create `uiStore`.** Move selection, zoom, dialog visibility.
4. **Commit 3: migrate `components/inspector/`.** Inspector is the largest context consumer; doing it first smokes out any API gaps.
5. **Commit 4: migrate `components/timeline/`.** Many per-clip renders — the perf win is here.
6. **Commit 5: migrate `components/preview/`, `panels/`, `caption/`, `dialogs/`.**
7. **Commit 6: migrate `hooks/`.** Replace internal `useContext` calls.
8. **Commit 7: delete old context files + `EditorProviders` slim-down.**
9. Full smoke — every UI interaction: click clip, drag clip, resize panel, change preset, toggle track mute, add text, undo, redo, play, pause, scrub, export.
10. Type-check, lint, test. PR.

## Validation

| Check | How |
| --- | --- |
| Provider count | `EditorProviders.tsx` has ≤ 1 provider wrapping `{children}` |
| Context imports gone | `grep -rn "EditorDocumentStateContext\|EditorDocumentActionsContext\|EditorClipCommandsContext\|EditorSelectionContext\|EditorUIContext\|EditorPersistContext\|EditorPlaybackContext" frontend/src` → no hits outside store definitions or deletions |
| Selector pattern | `grep -rn "useTimelineStore(" frontend/src` — every hit has a selector arg |
| No whole-store subscription | Automated: grep for `useTimelineStore()` with no args → should be zero |
| Inspector interaction | Editing a clip property causes ONLY Inspector + TimelineClip for that clip to commit; not the whole workspace |

## Exit Criteria

- Context files in `features/editor/context/` mostly deleted (only `PlayheadClockContext` might remain if still useful; probably also deleted).
- Stores own all editor state.
- Measured: inspector typing doesn't cause `PreviewCanvas` rerender.

## Rollback

Revert phase-08 PR. The reducer is untouched inside (Zustand wraps it), so the logic is safe; the plumbing is the only thing that changes.

## Estimate

3–5 days. Mechanical but voluminous. The risk is missing a consumer — TypeScript catches most, but runtime `undefined`s show up in rarely-clicked UI. Budget half a day for those.

## Perf Budget Gate

- Typing in an inspector field: ≤ 2 component commits per keystroke (the input + immediate derived display).
- No commits in `PreviewCanvas`, `TimelineRuler`, other "elsewhere" components during inspector typing.
