# Phase 3 — State Foundation (Total Rewrite)

> **The most important phase in this migration.** The current state machinery is the root cause of every other problem. This phase burns it down and replaces it with OpenReel's pattern end-to-end.
> Nothing downstream (clock, render, captions, export, autosave) will deliver its promised wins until this is done.

## What's Being Replaced (Condemned Code)

Verified by direct read. These files / patterns are all deleted or drastically rewritten in this phase:

| What | Where | Why it dies |
| --- | --- | --- |
| Monolithic `EditorState = Document & Playback & UI` | `types/editor.ts:16` | 3 concerns in one blob; any change wakes everyone |
| Full-state snapshot undo stack | `model/editor-reducer-helpers.ts:285-289`, `editor-reducer-session-ops.ts:47,55,63,80,96,111` | 50 full-state copies on a stack; each edit allocates a whole `EditorState` into `past[]` |
| `useReducer` god store | `hooks/useEditorStore.ts` (235 lines, 35 callbacks) | Any action rerenders whole subtree; components can't subscribe to slices |
| 8 React contexts slicing the god state | `context/*.tsx` (8 files, 258 lines total) | Every re-memoized value cascades through the tree |
| `EditorProviders.tsx` 9-deep provider nest | `components/layout/EditorProviders.tsx:380-400` | Sprawl; no sane way to add surgical subscriptions |
| Playback state living inside document state | `types/editor-playback.ts`, actions `SET_CURRENT_TIME`/`SET_PLAYING`/`SET_PLAYBACK_RATE` | Playback is ephemeral; does not belong in undoable state |
| UI state (zoom, selection) in same state tree as tracks | `types/editor-ui.ts` | Zoom change treated as undoable edit |
| 35 `useCallback`-wrapped dispatchers threaded into contexts | `useEditorStore.ts:17-232` | The indirection that lets React think each callback is "stable" — costs more than it saves |

After phase 3: **none of the above exists.** Editor runs on Zustand stores with selector subscriptions and an action-based history. Exactly OpenReel's pattern.

## New State Architecture (What Replaces It)

Four Zustand stores, each with `subscribeWithSelector` middleware. Components subscribe to narrow selectors. No React contexts for state.

```
frontend/src/features/editor/stores/
  projectStore.ts       # Document data only (tracks, subtitles, caption doc, project meta)
  uiStore.ts            # Ephemeral UI (selection, zoom, panels, dialogs)
  playbackStore.ts      # Ephemeral playback state — but minimal; the clock (phase 4) owns time
  engineStore.ts        # Engine handles (clock, video engine, decoder pool, etc.). Exists already from phase 2.

frontend/src/editor-core/timeline/
  actions.ts            # Action types + ActionExecutor (action-based undo)
```

### Why four stores, not one

| Store | Lifetime | Undoable? | Persists to server? |
| --- | --- | --- | --- |
| `projectStore` | Project open → close | **Yes** | Yes (autosave) |
| `uiStore` | Browser tab session | No | Optional (localStorage for user prefs) |
| `playbackStore` | Playback session | No | No |
| `engineStore` | Editor mount → unmount | No | No |

Merging them = you lose the natural distinction and pay for it everywhere else.

### What lives where (exact shapes)

**`projectStore`** — the only store whose state is undoable and server-persisted.

```ts
export interface ProjectState {
  // Identity
  readonly id: string | null;
  readonly version: number;
  readonly lastSavedAt: Date | null;

  // Document
  readonly title: string;
  readonly resolution: string;
  readonly fps: 24 | 25 | 30 | 60;
  readonly tracks: readonly Track[];
  readonly subtitles: readonly Subtitle[];
  readonly captionDocs: ReadonlyMap<string, CaptionDoc>;   // by id
  readonly captionPresets: ReadonlyMap<string, CaptionPreset>;

  // Derived / cached
  readonly durationMs: number;

  // Actions (see Action System below — these all delegate to dispatchAction)
  dispatch(action: ProjectAction): void;
  undo(): void;
  redo(): void;
  hydrate(project: EditProject): void;
}
```

**`uiStore`** — ephemeral, per-tab.

```ts
export interface UIState {
  selectedClipId: string | null;
  selectedTrackId: string | null;
  zoom: number;                        // timeline zoom
  leftPanelWidth: number;
  inspectorTab: "adjust" | "animate" | "effects" | "project";
  activeDialog: "export" | "shortcuts" | null;
  conflictDetected: boolean;           // autosave saw a 409
  exportJob: { id: string; status: ExportJobStatus } | null;

  select(clipId: string | null): void;
  setZoom(zoom: number): void;
  openDialog(name: UIState["activeDialog"]): void;
  // ...
}
```

**`playbackStore`** — intentionally thin. After phase 4 the clock owns `currentMs` entirely; this store only keeps state the clock doesn't.

```ts
export interface PlaybackState {
  playbackRate: number;                // 0.5 / 1 / 2
  loop: boolean;
  inPointMs: number | null;            // scrub range start
  outPointMs: number | null;           // scrub range end

  setRate(rate: number): void;
  setLoop(loop: boolean): void;
  setInOut(inMs: number | null, outMs: number | null): void;
}
```

Notice what's NOT here: `currentTimeMs`, `isPlaying`. Those live on the clock (phase 4). This store exists in phase 3 as a shape-only placeholder so downstream phases don't bikeshed.

**`engineStore`** — already written in phase 2; no change.

## Action System (Replaces Reducer)

Snapshot undo dies. Action-based undo replaces it.

```
frontend/src/editor-core/timeline/
  actions.ts            # Action types — discriminated union
  ActionExecutor.ts     # Execute, undo, redo
  ClipOps.ts            # pure: (state, params) → {nextState, inverse}
  TrackOps.ts           # same
  TransitionOps.ts      # same
  CaptionOps.ts         # same
```

### Action shape

```ts
export type ActionType =
  | "clip/add" | "clip/remove" | "clip/update" | "clip/move" | "clip/split"
  | "clip/ripple-delete" | "clip/duplicate" | "clip/toggle-enabled" | "clip/paste"
  | "track/add" | "track/remove" | "track/rename" | "track/reorder"
  | "track/toggle-mute" | "track/toggle-lock"
  | "transition/set" | "transition/remove"
  | "caption/add" | "caption/update-style"
  | "meta/set-title" | "meta/set-resolution" | "meta/set-fps";

export interface Action<T extends ActionType = ActionType> {
  readonly id: string;              // uuid
  readonly type: T;
  readonly params: ActionParams[T];
  readonly timestampMs: number;
}

export type ActionParams = {
  "clip/add":       { trackId: string; clip: Clip };
  "clip/remove":    { clipId: string };
  "clip/update":    { clipId: string; patch: ClipPatch };
  "clip/move":      { clipId: string; startMs: number };
  "clip/split":     { clipId: string; atMs: number };
  // …
};
```

### ActionExecutor

```ts
export interface ExecuteResult<S> {
  readonly nextState: S;
  readonly inverse: Action;         // the action that undoes this one
}

export type ActionHandler<S, T extends ActionType> = (
  state: S, params: ActionParams[T],
) => ExecuteResult<S>;

export class ActionExecutor<S> {
  private readonly handlers = new Map<ActionType, ActionHandler<S, ActionType>>();
  private readonly undoStack: Action[] = [];
  private readonly redoStack: Action[] = [];
  private readonly limit = 200;

  register<T extends ActionType>(type: T, h: ActionHandler<S, T>): void {
    this.handlers.set(type, h as ActionHandler<S, ActionType>);
  }

  execute(state: S, action: Action): S {
    const h = this.handlers.get(action.type);
    if (!h) throw new Error(`no handler for ${action.type}`);
    const { nextState, inverse } = h(state, action.params as never);
    this.undoStack.push(inverse);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    return nextState;
  }

  undo(state: S): S {
    const inv = this.undoStack.pop();
    if (!inv) return state;
    const h = this.handlers.get(inv.type);
    if (!h) return state;
    const { nextState, inverse } = h(state, inv.params as never);
    this.redoStack.push(inverse);
    return nextState;
  }

  redo(state: S): S {
    const a = this.redoStack.pop();
    if (!a) return state;
    const h = this.handlers.get(a.type);
    if (!h) return state;
    const { nextState, inverse } = h(state, a.params as never);
    this.undoStack.push(inverse);
    return nextState;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
```

### Ops files — pure, testable

Each op exports a handler AND its inverse.

```ts
// editor-core/timeline/ClipOps.ts

export const addClip: ActionHandler<ProjectState, "clip/add"> = (state, { trackId, clip }) => {
  const tracks = state.tracks.map((t) =>
    t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
  );
  return {
    nextState: { ...state, tracks, durationMs: computeDuration(tracks) },
    inverse: { id: uuid(), type: "clip/remove", params: { clipId: clip.id }, timestampMs: Date.now() },
  };
};

export const removeClip: ActionHandler<ProjectState, "clip/remove"> = (state, { clipId }) => {
  const original = findClip(state.tracks, clipId);
  if (!original) throw new Error(`clip ${clipId} not found`);
  const tracks = state.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) }));
  return {
    nextState: { ...state, tracks, durationMs: computeDuration(tracks) },
    inverse: { id: uuid(), type: "clip/add", params: { trackId: original.trackId, clip: original.clip }, timestampMs: Date.now() },
  };
};
```

### Why action-based beats snapshot-based undo here

- **Memory.** 50 snapshots of a 100-clip timeline ≈ 50 × (whatever). 200 actions × a few bytes each. Orders of magnitude less.
- **Ops semantics.** Inverses let downstream systems (autosave, collaboration, analytics) see WHAT happened, not just "state diffs."
- **Correctness.** Snapshots silently include ephemeral fields (`currentTimeMs`, `zoom`) — undoing a cut should not rewind zoom. Action-based only touches what the op touched.
- **Testing.** Each op is pure, trivially unit-testable with golden states.

## Selector Discipline (The Performance Payoff)

Every component read goes through a selector. No exceptions.

```ts
// ✅ correct
const tracks = useProjectStore((s) => s.tracks);
const selectedClipId = useUIStore((s) => s.selectedClipId);

// ❌ forbidden — subscribes to every field
const state = useProjectStore();
```

Lint rule (see "Enforcement" below) bans the no-arg form.

### Shallow for derived objects

```ts
import { shallow } from "zustand/shallow";

const { fps, resolution } = useProjectStore(
  (s) => ({ fps: s.fps, resolution: s.resolution }),
  shallow,
);
```

### Per-clip selectors (critical)

Timeline UI has one `<TimelineClip>` per clip. Each component reads only its own clip:

```ts
function TimelineClip({ clipId }: { clipId: string }) {
  const clip = useProjectStore(
    (s) => s.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId) ?? null,
    shallow,
  );
  // ...
}
```

When the user drags clip X, only clip X's component re-renders. Clips Y and Z are unchanged — their selector returns the same reference.

This is the OpenReel pattern. Contexts can never do this efficiently.

## Enforcement (ESLint Rules)

Add to frontend ESLint config:

```js
// forbid bare zustand subscription
{
  selector: "CallExpression[callee.name=/^use(Project|UI|Playback)Store$/][arguments.length=0]",
  message: "useProjectStore / useUIStore / usePlaybackStore must take a selector argument",
}

// forbid createContext for editor state
{
  files: ["src/features/editor/**"],
  rules: {
    "no-restricted-syntax": ["error", {
      selector: "CallExpression[callee.name='createContext']",
      message: "Editor state lives in stores, not contexts. Use useProjectStore/useUIStore.",
    }],
  },
},

// editor-core stays React-free (from phase 2)
```

Temporarily whitelist `PlayheadClockContext` if anything still depends on it until phase 4 replaces it; delete the whitelist at phase 4 exit.

## DevTools

Zustand `devtools` middleware on all four stores so every action is logged in Redux DevTools. Invaluable for the rest of the migration.

```ts
import { devtools, subscribeWithSelector } from "zustand/middleware";

export const useProjectStore = create<ProjectState>()(
  devtools(
    subscribeWithSelector((set, get) => ({ ... })),
    { name: "projectStore", enabled: import.meta.env.DEV },
  ),
);
```

## Files Touched

### New (15)
- `frontend/src/features/editor/stores/projectStore.ts`
- `frontend/src/features/editor/stores/uiStore.ts`
- `frontend/src/features/editor/stores/playbackStore.ts`
- `frontend/src/features/editor/stores/selectors.ts` — shared memoized selectors (e.g. `selectClipById(id)`)
- `frontend/src/features/editor/stores/hydrate.ts` — `hydrateFromProject(project)` and `dehydrateForSave()`
- `frontend/src/editor-core/timeline/actions.ts`
- `frontend/src/editor-core/timeline/ActionExecutor.ts`
- `frontend/src/editor-core/timeline/ops/ClipOps.ts`
- `frontend/src/editor-core/timeline/ops/TrackOps.ts`
- `frontend/src/editor-core/timeline/ops/TransitionOps.ts`
- `frontend/src/editor-core/timeline/ops/CaptionOps.ts`
- `frontend/src/editor-core/timeline/ops/MetaOps.ts`
- `frontend/src/editor-core/timeline/ops/index.ts` — registers every handler on a shared `ActionExecutor`
- `frontend/__tests__/unit/features/editor/stores/projectStore.test.ts`
- `frontend/__tests__/unit/features/editor/timeline/ActionExecutor.test.ts`

### Modify (heavy)
- `frontend/src/features/editor/components/layout/EditorProviders.tsx` — strip down to a shell that hydrates stores from the loaded project on mount. No provider nest. No memos.
- Every file under `components/` that did `useContext(EditorXContext)` — switch to a store selector. Sweep list in "Sweep Plan" below.
- Every file under `hooks/` that consumed contexts — switch to stores or delete.

### Delete
- `frontend/src/features/editor/hooks/useEditorStore.ts` — 235 lines gone
- `frontend/src/features/editor/model/editor-reducer.ts`
- `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`
- `frontend/src/features/editor/model/editor-reducer-session-ops.ts`
- `frontend/src/features/editor/model/editor-reducer-track-ops.ts`
- `frontend/src/features/editor/model/editor-reducer-helpers.ts`
- `frontend/src/features/editor/context/EditorClipCommandsContext.tsx`
- `frontend/src/features/editor/context/EditorDocumentActionsContext.tsx`
- `frontend/src/features/editor/context/EditorDocumentStateContext.tsx`
- `frontend/src/features/editor/context/EditorPersistContext.tsx`
- `frontend/src/features/editor/context/EditorPlaybackContext.tsx`
- `frontend/src/features/editor/context/EditorSelectionContext.tsx`
- `frontend/src/features/editor/context/EditorUIContext.tsx`
- (keep `PlayheadClockContext.tsx` temporarily; phase 4 deletes it)
- `frontend/src/features/editor/types/editor-playback.ts`, `editor-ui.ts` — the combined `EditorState` is gone; these standalone types may or may not be reused by the new stores depending on how types shake out. Kill if orphaned.

**Line count delta, estimated:** -1800 lines raw (reducer + hook + contexts), +900 lines (stores + ops + tests). Net -900 lines.

## Sweep Plan — Component Migration

Every file in `features/editor/components/` that uses `useContext(EditorXContext)` needs rewriting. Order: inspector → timeline → preview → caption → dialogs → layout. Inspector first because it's the heaviest context consumer; surfacing missing APIs there protects the rest.

For each file, the rewrite is mechanical:

```diff
- const { tracks } = useContext(EditorDocumentStateContext);
- const { updateClip } = useContext(EditorClipCommandsContext);
+ const tracks = useProjectStore((s) => s.tracks);
+ const dispatch = useProjectStore((s) => s.dispatch);
+ const updateClip = useCallback(
+   (id: string, patch: ClipPatch) =>
+     dispatch({ id: uuid(), type: "clip/update", params: { clipId: id, patch }, timestampMs: Date.now() }),
+   [dispatch],
+ );
```

Or, cleaner, expose convenience actions on the store itself:

```ts
// projectStore.ts
addClip(trackId: string, clip: Clip) {
  const action: Action<"clip/add"> = { id: uuid(), type: "clip/add", params: { trackId, clip }, timestampMs: Date.now() };
  set((s) => ({ ...executor.execute(s, action) }));
},
```

Then components call `useProjectStore((s) => s.addClip)` and invoke it.

## Step-by-Step

1. Branch `migration/phase-03-state-foundation`.
2. **Commit 1: Action system in `editor-core/timeline/`.** No consumers yet. Unit-test the executor, 3 ops round-trip (add → undo → redo leaves state unchanged).
3. **Commit 2: `projectStore`.** Wire to `ActionExecutor`. Include hydrate/dehydrate. Unit-test: loading a known project then `addClip`, then `undo`, leaves the exact original state (deep-equal).
4. **Commit 3: `uiStore` and `playbackStore`.** Simple stores; no ops.
5. **Commit 4: Migrate inspector components.** Replace all `useContext` reads with `useProjectStore`/`useUIStore`. Keep old contexts alive temporarily — they'll have no consumers after each sweep, but don't delete until commit 9.
6. **Commit 5: Migrate timeline components.** Heavy; expect ~10 files. Per-clip selector pattern becomes critical here; unit/visual test that dragging clip X doesn't re-render clips Y/Z.
7. **Commit 6: Migrate preview, caption, dialogs, layout, panels.**
8. **Commit 7: Migrate `hooks/`.** `useEditorClipActions`, `useEditorTransport`, `useEditorLayoutMutations`, etc. Any that were thin wrappers around reducer callbacks become thin wrappers around store actions.
9. **Commit 8: Gut `EditorProviders.tsx`.** After the sweep no component still reads contexts. Drop every `Provider`. Replace the whole file with:

```tsx
export function EditorProviders({ project, children }: { project: EditProject; children: ReactNode }) {
  useEffect(() => {
    useProjectStore.getState().hydrate(project);
    const engineStore = useEngineStore.getState();
    void engineStore.initialize();
    return () => engineStore.dispose();
  }, [project.id]);
  return <>{children}</>;
}
```

10. **Commit 9: Delete condemned code.**
    - All 7 `context/Editor*Context.tsx` files (save `PlayheadClockContext` for phase 4).
    - `hooks/useEditorStore.ts`.
    - `model/editor-reducer*.ts` (5 files).
    - Orphaned types.
11. **Commit 10: ESLint rules.** Add the selector-required rule and `createContext` ban.
12. Type-check (`bun run type-check`), lint, test, smoke. PR.

## Validation

| Check | Command / Method | Expected |
| --- | --- | --- |
| All reducer files gone | `ls frontend/src/features/editor/model` | directory empty or missing |
| `useEditorStore` gone | `grep -rn "useEditorStore\|useEditorReducer" frontend/src` | zero matches |
| Contexts gone | `grep -rn "EditorClipCommandsContext\|EditorDocumentStateContext\|EditorDocumentActionsContext\|EditorPlaybackContext\|EditorSelectionContext\|EditorUIContext\|EditorPersistContext" frontend/src` | zero matches |
| No `createContext` in editor | `grep -rn "createContext" frontend/src/features/editor` | only `PlayheadClockContext` (temporary) |
| Every store call has a selector | `grep -rn "useProjectStore()\|useUIStore()\|usePlaybackStore()" frontend/src` | zero matches |
| Types | `bun run type-check` | exit 0 |
| Lint | `bun run lint` | exit 0, the new rules fire if you try to regress |
| Tests | `bun test` | all pass, ops + store tests included |
| Undo/redo | Manual | Add clip → undo → original state. Redo restores. Zoom unaffected by undo. Selection unaffected by undo. |
| Profiler: inspector typing | React DevTools | Only the Inspector input and its immediate derived label commit. Zero commits elsewhere. |
| Profiler: drag clip X | React DevTools | Only `<TimelineClip clipId="X">` commits. Clips Y/Z zero commits. |
| Profiler: playback (pre phase 4) | React DevTools | Still some commits via playback context — fixed in phase 4. Should already be fewer than today. |

## Exit Criteria

- Zero reducer files. Zero `useEditorStore`. Zero editor contexts except `PlayheadClockContext` (on death row for phase 4).
- Four stores: `projectStore`, `uiStore`, `playbackStore`, `engineStore`.
- Every state read in `features/editor/**` goes through a typed selector.
- Undo/redo is action-based, tested round-trip, capped at 200 actions.
- ESLint enforces the pattern — intentionally regressing (writing `useContext(...)` on an editor context, or `useProjectStore()` with no selector) fails CI.
- Inspector typing and clip dragging confirmed in profiler to cause only their own components to re-render.

## Rollback

Large revert. Keep this as a single PR for clean revert. If regressions slip through, there's no partial rollback — revert + fix + re-submit.

## Estimate

7–10 days, the biggest phase. Distribution:

- Action system + executor + ops: 1.5 days
- Stores + hydrate/dehydrate + tests: 1 day
- Inspector sweep: 1 day
- Timeline sweep (trickiest — per-clip selectors): 2 days
- Remaining component sweeps: 1 day
- Hooks sweep: 0.5 day
- EditorProviders gut + delete old: 0.5 day
- ESLint + DevTools + polish: 0.5 day
- Smoke + profiler validation + unexpected regressions: 1–2 days

Budget for surprises. Regressions in rarely-clicked UI show up here; give yourself time.

## Perf Budget Gate

Must pass before merging:

- Profiler: typing in an inspector input → ≤ 2 component commits per keystroke.
- Profiler: dragging clip X → only `<TimelineClip clipId="X">` commits among timeline clips.
- Profiler: clicking a clip (select) → only the previously-selected and newly-selected clip components commit.
- Undo after `addClip`: deep-equals pre-add state (test asserts).
- 200 consecutive edits then 200 undos: final state === initial state (fuzz test).
- Bundle size delta: net reduction (≈ -900 lines → ~30 KB min gzip less, roughly).

Any fail = fix before merge.

## Why This Phase Must Come Before Clock/Render/Captions

Every downstream phase assumes:
- A store it can subscribe to for its slice of state.
- Per-component selectors so its render work doesn't wake the whole tree.
- Action-based mutations so engine bridges can emit them cleanly (e.g. `RenderBridge` subscribes to `projectStore.tracks`, not a context).

If we did clock or render first, we'd have to re-wire them again after the state rewrite. That's wasted work and a merge nightmare.

## Out of Scope

- Touching `PreviewEngine` (phase 4–5).
- Moving engine files into `editor-core/` beyond the already-scaffolded stubs.
- Adopting OpenReel's clip shape (`inPoint`/`outPoint` vs `trimStartMs`/`trimEndMs`) — a separate, optional, non-urgent phase later if desired.
- Collaboration, server-side action sync, realtime multi-user — the action system makes these possible in future but is not a feature of this phase.
