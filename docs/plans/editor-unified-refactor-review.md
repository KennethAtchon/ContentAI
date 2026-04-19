# ReelStudio Editor Unified Refactor Review

> Date: 2026-04-18
> Scope: `docs/plans/editor-unified-architecture.md` plus the current React editor refactor
> Status: Review notes and follow-up work

## Executive Summary

The refactor moved the editor in the right direction. The old `useEditorLayoutRuntime` and `EditorContext` are gone, `EditorLayout` is now a thin shell, the project list and caption orchestration were extracted, and editor unit tests still pass. That is real progress: the editor is already easier to scan than the prior prop-drilled runtime.

The main long-term risk is that the split-context pattern has not fully held. The old god hook has mostly turned into `EditorProviders`, and `EditorDocumentContext` is already carrying document state, UI state, store commands, clip workflow commands, and a `QueryClient`. This compiles, but it weakens the core design goal: make ownership obvious and keep re-render/debug surfaces small.

## Verification

Commands run from `frontend/`:

- `bun run type-check` passed.
- `bun test __tests__/unit/features/editor` passed: 83 tests.
- `bun run lint` failed with four errors and one warning.

Current lint failures:

- `frontend/src/features/editor/components/layout/EditorWorkspace.tsx:24` has an unused `playheadMs` binding.
- `frontend/src/features/editor/context/EditorDocumentContext.tsx:7` has unused `EditProject`.
- `frontend/src/features/editor/context/EditorDocumentContext.tsx:10` has unused `ClipPatch`.
- `frontend/src/features/editor/context/EditorDocumentContext.tsx:11` has unused `CaptionStyleOverrides`.
- `frontend/src/features/editor/components/layout/EditorProviders.tsx:241` has an unused `eslint-disable` directive.

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

### 1. Fix Lint Before Continuing

The code type-checks, but lint is red. This should be cleaned up before additional architecture work, because lint failures hide migration debris and lower confidence in future diffs.

Fixes are small:

- Remove `playheadMs` from the `useEditorPlaybackContext()` destructure in `EditorWorkspace`.
- Remove unused imports from `EditorDocumentContext`.
- Remove the unused `eslint-disable` in `EditorProviders`.

### 2. Prevent `EditorDocumentContext` From Becoming The New God Context

`EditorDocumentContext` currently contains:

- Document state: tracks, title, duration, fps, resolution.
- UI state: `selectedClipId`, `exportJobId`, `exportStatus`.
- Derived state: `selectedClip`, `selectedTrack`, `selectedTransition`.
- Low-level store actions: dispatch, setTitle, addClip, updateClip, undo, redo, etc.
- Higher-level workflow actions: split, duplicate, paste, focus media, select transition.
- Infrastructure: `queryClient`.

That is too much surface for a context whose name says "document." It makes subscribers hard to reason about, and it invites every editor component to depend on the largest possible bag of editor capabilities.

Recommended split:

- `EditorDocumentStateContext`: persisted document fields only.
- `EditorDocumentActionsContext`: reducer commands for document edits.
- `EditorSelectionContext`: selected clip, selected track, selected transition, selection setters.
- `EditorClipCommandsContext`: workflow commands such as split, duplicate, paste, focus media.
- Keep `QueryClient` out of editor domain context; localize cache invalidation to the component or command that needs it.

This does not need to be an over-engineered provider forest. A small set of focused contexts is enough. The key rule: a context name should accurately describe every value in it.

### 3. Split `EditorProviders` Before It Becomes Permanent Runtime Glue

`EditorProviders` is now the only place that knows about reducer state, autosave, polling, asset maps, mutations, clip actions, keyboard shortcuts, transport, refs, and all context values. That is an improvement over prop drilling, but it is still a central orchestration object.

Recommended next step:

- Move autosave service creation into `useEditorAutosave`.
- Move provider value construction into focused hooks, for example `useEditorDocumentProviderValue`, `useEditorPlaybackProviderValue`, and `useEditorUIProviderValue`.
- Keep `EditorProviders` as a composition layer only.

The goal is not fewer lines for its own sake. The goal is debuggability: when publish breaks, the save/publish path should be isolated; when selection breaks, the selection path should be isolated.

### 4. Finish The SaveService Encapsulation

The plan said only autosave should touch `saveTimerRef` and `editorPublishStateRef`. The current implementation still destructures those refs from `useEditorAutosave` in `EditorProviders` and builds `saveService` there.

Better shape:

```ts
const { lastSavedAt, isDirty, isSavingPatch, saveService } = useEditorAutosave(...)
```

Then `useEditorAutosave` owns:

- latest publish snapshot
- timer cancellation
- dirty fingerprint
- flush payload construction
- in-flight save policy

That makes `SaveService` a real boundary instead of a convenience wrapper.

### 5. Remove The Type-Level Circular Dependency

`editor.ts` imports `EditorDocumentState`, `EditorPlaybackState`, and `EditorUIState`, while `editor-document.ts` imports `EditorHistorySnapshot`, `Track`, and `Clip` from `editor.ts`. The same cycle exists with `editor-ui.ts` and `ExportJobStatus`.

It currently passes TypeScript, but it is not a good long-term module shape. These files are intended to clarify domains, but the cycle makes the domain split harder to trust.

Recommended fix:

- Move base domain types (`Clip`, `Track`, `Transition`, `ExportJobStatus`, `EditorHistorySnapshot`) to a file that does not import state slices, such as `editor-domain.ts`.
- Let `editor.ts` re-export and compose the final `EditorState`.
- Use `import type` for type-only imports.

### 6. Add Context-Level Tests

The current editor tests protect reducer and engine behavior well, but there is no test coverage for the new provider contracts.

Add focused tests for:

- `EditorProviders` exposes document values without playback tick churn.
- `SaveService.flushNow()` sends stripped tracks, `durationMs`, title, resolution, and fps.
- Publish calls `cancelPending()` before `flushNow()` before `runPublish()`.
- Caption playback sync does not re-enter `renderCurrentFrame`.
- `TimelineSection` sync invalidates the project query only when an edit project id exists.

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

1. Clean up the lint errors.
2. Move `saveService` construction inside `useEditorAutosave`.
3. Split `EditorDocumentContext` into state, actions, selection, and clip-command contexts.
4. Add provider-level tests for save/publish/context behavior.
5. Update `editor-unified-architecture.md` to mark phases 1 through 5 as implemented-with-follow-ups, and keep Rust/WASM phases as future work.

## Current Verdict

The refactor is directionally correct and already pays off in readability. It should work for the near term, and the passing editor test suite gives a decent safety net.

For the long term, the pattern needs one more tightening pass. Without it, the project will drift from "split domain contexts" into "one huge provider with nicer component call sites." The next pass should make ownership explicit, hide autosave internals, and add tests around the new runtime boundaries before the Rust compositor work begins.
