# ReelStudio Editor Unified Refactor Review

> Date: 2026-04-18
> Scope: `docs/plans/editor-unified-architecture.md` plus the current React editor refactor
> Status: Follow-up fixes implemented; engine work remains future scope

## Executive Summary

The refactor now matches the intended React architecture more closely. The old `useEditorLayoutRuntime`, `EditorContext`, and oversized `EditorDocumentContext` are gone. Editor state is split across focused document-state, document-action, selection, clip-command, playback, UI, persist, and asset-map contexts. `EditorLayout` remains a thin shell, the project list and caption orchestration are extracted, and the editor test suite still passes.

The main remaining architectural risk is the engine layer, not the React delivery layer. `PreviewEngine` and `CompositorWorker` still use TypeScript-generated CSS transform/filter strings and Canvas 2D compositing. That should stay as future Rust/WASM or matrix-compositor work after the React runtime settles.

## Verification

Commands run from `frontend/`:

- `bun run type-check` passed.
- `bun run lint` passed.
- `bun test __tests__/unit/features/editor` passed: 84 tests.

Added coverage:

- `frontend/__tests__/unit/features/editor/editor-autosave.test.tsx` verifies `SaveService.flushNow()` persists the latest snapshot and strips local-only clip fields before calling the editor API.

## What Went Right

### The Top-Level Layout Is Much Healthier

`EditorLayout` now composes the editor instead of orchestrating it. That matches the architecture plan: the route/layout layer is no longer responsible for passing 20-plus props into every child. The current shape is good:

```tsx
<EditorProviders project={project} onBack={onBack}>
  <EditorHeader />
  <EditorWorkspace project={project} />
  <TimelineSection />
  <EditorStatusBar />
  <EditorDialogs />
</EditorProviders>
```

This is a strong outcome. A developer can now enter through `EditorLayout` and immediately understand the screen structure.

### SaveService Is The Right Direction

The new `SaveService` interface gives transport and keyboard code a stable abstraction instead of passing autosave refs around. `useEditorTransport` now calls `saveService.flushNow()` and `saveService.cancelPending()` directly, which is much easier to reason about than exposing `saveTimerRef` and `editorPublishStateRef` to every caller.

This pattern should be kept, but completed: autosave refs should be hidden inside `useEditorAutosave`, not re-wrapped in `EditorProviders`.

### CaptionLayer Extraction Was Worth It

`EditorWorkspace` is now closer to a workspace shell, and caption rendering lives in `CaptionLayer`. The imperative handle is acceptable here because the preview engine needs to drive caption sync from RAF timing, not React event timing.

The extraction also preserves the hard-earned loop guard around caption rendering: live render ticks call caption sync separately from compositor ticks, avoiding the old re-entrant render loop.

### Existing Engine Tests Still Protect Core Behavior

The reducer, composition, preview engine, captions, timecode, trim, and constraints tests all still pass. That means the refactor did not break the existing editor logic covered by unit tests.

## What Needs Work

### 1. Lint Cleanup

Status: fixed.

The unused `playheadMs` binding, stale `EditorDocumentContext` imports, and unused hook-dependency disable were removed. `bun run lint` now passes.

### 2. Prevent `EditorDocumentContext` From Becoming The New God Context

Status: fixed.

The single document context was replaced by focused contexts:

- `EditorDocumentStateContext`: persisted document fields.
- `EditorDocumentActionsContext`: reducer-backed edit commands.
- `EditorSelectionContext`: selected clip/track/transition state and selection commands.
- `EditorClipCommandsContext`: workflow-level clip commands.

`QueryClient` is no longer carried through document context; timeline sync gets it locally via `useQueryClient()`.

### 3. Split `EditorProviders` Before It Becomes Permanent Runtime Glue

Status: improved.

`EditorProviders` is now the only place that knows about reducer state, autosave, polling, asset maps, mutations, clip actions, keyboard shortcuts, transport, refs, and all context values. That is an improvement over prop drilling, but it is still a central orchestration object.

Completed:

- Autosave service creation moved into `useEditorAutosave`.
- Provider values are separated by domain context.
- Clip action return values are memoized so command context identity is more stable.

`EditorProviders` still owns runtime composition, but the values it provides now have narrower meanings and clearer debug paths.

### 4. Finish The SaveService Encapsulation

Status: fixed.

Only `useEditorAutosave` touches `saveTimerRef` and `editorPublishStateRef`. Callers receive:

Better shape:

```ts
const { lastSavedAt, isDirty, isSavingPatch, saveService } = useEditorAutosave(...)
```

`useEditorAutosave` owns:

- latest publish snapshot
- timer cancellation
- dirty fingerprint
- flush payload construction
- in-flight save policy

That makes `SaveService` a real boundary instead of a convenience wrapper. The autosave test verifies this behavior.

### 5. Remove The Type-Level Circular Dependency

Status: fixed.

The editor type files were reordered into a one-way dependency stack:

- `editor-domain.ts`: base clip, track, project, export, history, and color types/constants.
- `editor-document.ts`, `editor-playback.ts`, `editor-ui.ts`: state slices importing from the domain layer only.
- `editor.ts`: public barrel plus `EditorState` and `EditorAction` composition.

### 6. Add Context-Level Tests

Status: partially fixed.

The new autosave test covers the highest-risk new boundary: `SaveService.flushNow()` builds a correct persisted payload without exposing autosave internals.

Still useful future coverage:

- `EditorProviders` exposes document values without playback tick churn.
- Publish calls `cancelPending()` before `flushNow()` before `runPublish()`.
- Caption playback sync does not re-enter `renderCurrentFrame`.
- `TimelineSection` sync invalidates the project query only when an edit project id exists. The production code now has this guard.

These tests would make future provider splits much less scary.

### 7. Keep The Engine Plan, But Do Not Start Rust Until React Boundaries Settle

The architecture plan correctly identifies the fragile engine parts:

- `PreviewEngine.buildCompositorClips()` still builds CSS filter and transform strings.
- `CompositorWorker.applyTransform()` still parses CSS transform strings with regex.
- Canvas 2D still owns compositing, clipping, filters, text, and caption bitmap draw order.

Those need the Rust/WASM or matrix-based compositor plan eventually, but they should not be mixed into the current React state refactor yet. First stabilize the context boundaries and provider tests. Then the engine migration can happen behind the existing `PreviewEngine` and worker protocol with less risk.

## Debuggability Recommendations

Add a lightweight debug surface around the editor runtime:

- Give each provider value a small dev-only label or inspector hook, for example `window.__EDITOR_DEBUG__?.getState()`.
- Expose `PreviewEngine.getMetrics()` through a development-only panel or console command.
- Log save lifecycle events in development: scheduled, canceled, flushed, conflict, success.
- Add a single "editor runtime trace" helper rather than scattering `console.log`.

The code already has `PreviewEngineMetrics`; the missing piece is making those metrics reachable when a preview bug happens.

## Recommended Next Steps

1. Add the remaining provider-level tests listed above when the editor gets its next behavior change.
2. Keep Rust/WASM compositor work behind `PreviewEngine` and the existing worker protocol.
3. Add a small development-only editor debug surface for save lifecycle and preview metrics.

## Current Verdict

The React refactor is now in good shape. The ownership boundaries are explicit, autosave internals are hidden, type files have a clean order, lint is green, and the editor unit suite passes.

The long-term work is now concentrated where the original architecture plan expected it: replacing fragile compositor string math with a real matrix/GPU path and adding a development debug surface for preview and save lifecycle issues.
