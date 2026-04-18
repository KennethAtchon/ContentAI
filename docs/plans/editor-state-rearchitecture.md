# Editor State & UI Rearchitecture — Plan

> **Date:** 2026-04-18
> **Status:** Draft
> **Deciders:** Kenneth Atchon

---

## 1. Problem Statement

The editor subsystem is the most complex part of ReelStudio, and it has outgrown its current structure. The root cause is a single aggregator hook — `useEditorLayoutRuntime` — that orchestrates 8 sub-hooks and returns 25+ values, which are then manually prop-drilled through `EditorLayout` → `EditorWorkspace` → leaf components. Every file is entangled with nearly every other file, so answering "what does X do?" requires tracing a chain that touches 6–10 files.

Concretely:

- `useEditorLayoutRuntime` is 150 lines, accepts 2 params, and returns 25 values (`state`, `store`, `transport`, `clipActions`, `isDirty`, `isSavingPatch`, `lastSavedAt`, `isPublishing`, `isCapturingThumbnail`, `effectPreview`, `pendingAdd`, `playheadMs`, `selectedTransitionKey`, `mediaActiveTab`, `publishDialogOpen`, `showExport`, `queryClient`, `createNewDraft`, `isCreatingDraft`, `confirmScriptIteration`, `onScriptIterationDialogOpenChange`, `scriptResetPending`, `captureThumbnail`, `assetUrlMap`). It is a god hook.
- `EditorLayout` passes ~14 props to `EditorHeader`, ~30 to `EditorWorkspace`, and ~17 to `TimelineSection`. When a prop changes, the only way to know where it's used is to grep manually.
- `EditorState` in the reducer mixes three distinct concerns: **document data** (tracks, title, fps, resolution — must be persisted), **playback session** (currentTimeMs, isPlaying, playbackRate — ephemeral), and **UI state** (zoom, selectedClipId, clipboardClip — view-only). Any state change triggers all consumers.
- Save refs (`saveTimerRef`, `editorPublishStateRef`) flow from `useEditorAutosave` → `useEditorTransport` → `useEditorKeyboard` → `useEditorLayoutMutations` as explicit parameters. Four hooks are coupled to the autosave internals.
- `EditorWorkspace` manages caption rendering state (`captionBitmapQueueRef`, `activeCaptionClipId`, `pendingCaptionRenderTimeRef`), preview engine lifecycle, layout, and re-exports many props — four unrelated responsibilities in one component.

If nothing changes: every new feature in the editor requires touching `useEditorLayoutRuntime` and threading new props through 3–4 layers. This compounds — the file is already at the edge of comprehensibility.

---

## 2. Goals & Non-Goals

### Goals

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Eliminate the god hook | `useEditorLayoutRuntime` deleted; no replacement aggregator of comparable size |
| 2 | Eliminate prop drilling | Leaf components pull what they need from context; zero manual prop threading through intermediate layout components |
| 3 | Separate state domains | Document, playback, and UI state are distinct; changing playback time does not re-render the Inspector |
| 4 | Decouple autosave from transport/keyboard | No hook other than autosave holds save refs; other hooks call `saveService.flushNow()` |
| 5 | Co-locate caption logic | Caption render state lives in a dedicated hook, not in `EditorWorkspace` |

### Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Migrating to Zustand immediately | Valid future step, but not required to fix the coupling problem |
| 2 | Changing the editor's reducer logic | The reducer split (session/clip/track ops) is clean — only state shape and delivery change |
| 3 | Adding new editor features | This is a structural refactor only |
| 4 | Backend changes | All changes are in `frontend/src/features/editor/` |
| 5 | Rewriting the preview engine | `PreviewEngine.ts`, `AudioMixer.ts`, `DecoderPool.ts`, `CompositorWorker.ts` are not touched |

---

## 3. Background & Context

### Current file structure (relevant paths)

```
features/editor/
  types/editor.ts            — EditorState, all action types, Clip/Track types
  model/
    editor-reducer.ts        — composes sub-reducers
    editor-reducer-session-ops.ts
    editor-reducer-clip-ops.ts
    editor-reducer-track-ops.ts
    editor-reducer-helpers.ts
  hooks/
    useEditorStore.ts        — useReducer + 35 callback wrappers → EditorStore type
    useEditorLayoutRuntime.ts — GOD HOOK: orchestrates everything
    useEditorAutosave.ts     — PATCH debounce + refs
    useEditorTransport.ts    — playback controls + save flush on nav
    useEditorClipActions.ts  — clip CRUD wrappers
    useEditorLayoutMutations.ts — publish/createDraft/aiAssemble
    useEditorKeyboard.ts     — keyboard shortcuts
    useEditorProjectPoll.ts  — polling + merge
    useEditorAssetMap.ts     — assetId → URL resolution
    usePlayback.ts           — rAF loop (used by preview engine, not by hooks directly)
    usePreviewEngine.ts      — preview engine lifecycle
  context/
    EditorContext.tsx        — provides EditorStore + 3 derived values (selectedClip, selectedTrack, pixelsPerMs)
  contexts/
    asset-url-map-context.ts — separate context for asset URL map
  components/
    layout/
      EditorRoutePage.tsx    — project list + editor entry point (dual responsibility)
      EditorLayout.tsx       — mounts providers + distributes props
      EditorWorkspace.tsx    — preview + inspector + left panel + caption orchestration
      EditorHeader.tsx
      EditorStatusBar.tsx
    timeline/
      TimelineSection.tsx    — zoom toolstrip + timeline
      Timeline.tsx           — uses EditorContext directly
    inspector/
      Inspector.tsx          — uses EditorContext directly
    preview/
      PreviewArea.tsx
      PreviewCanvas.tsx
    panels/
      LeftPanel.tsx
    dialogs/
      EditorDialogs.tsx
```

### Current data flow (simplified)

```
EditorRoutePage
  activeProject → EditorLayout(project, onBack)
    useEditorLayoutRuntime(project, onBack) → runtime (25 values)
      EditorProvider(store) → context: EditorStore + selectedClip + selectedTrack + pixelsPerMs
        AssetUrlMapContext.Provider
          EditorHeader       ← 14 props from runtime
          EditorWorkspace    ← 30 props from runtime/state
            Timeline         ← uses EditorContext directly (good)
            Inspector        ← uses EditorContext directly (good)
          TimelineSection    ← 17 props from runtime
          EditorDialogs      ← 8 props from runtime
```

### Key constraints

- The reducer logic is correct and well-tested. We're changing how state is delivered, not what it computes.
- `EditorContext` is already consumed directly by `Timeline` and `Inspector` — this pattern is the target state for all components.
- The `EditProject` type from the server is the source of truth for document data. The reducer hydrates it into `EditorState`.

---

## 4. Research Summary

**God hook mitigation strategies**
Established pattern: split by single responsibility — each hook handles one domain (persistence, transport, clip actions), hooks take minimal parameters, and intermediate aggregators are replaced by context providers. The key insight: if a hook's return value has to be destructured across 5 callsites, it's doing too many things. Sources: dev.to/justboris/popular-patterns-and-anti-patterns-with-react-hooks, medium.com/@Blochware/avoiding-pitfalls-common-anti-patterns-in-react-hooks.

**Domain-driven context splitting**
Split contexts along update-frequency lines, not feature lines. State that updates 60 times/second (playback position) should never be in the same context as state that updates on user action (selected clip). Teams report 50–80% fewer unnecessary re-renders after splitting. Bounded context pattern: each domain gets its own folder with context, hook, and types co-located. Sources: developerway.com/posts/how-to-write-performant-react-apps-with-context, css-tricks.com/domain-driven-design-with-react.

**Zustand vs React Context for editors**
Zustand's selector model prevents cascade re-renders — in scenarios with 500 components, Context causes 85–150ms of render time vs 2–5ms with Zustand. For a video editor with per-frame playhead updates, this is material. However, migrating to Zustand is a separate phase from fixing the coupling problem; the two can be done independently. Sources: tkdodo.eu/blog/zustand-and-react-context, medium.com/@bloodturtle/react-state-management.

**Video editor architecture patterns**
CapCut-style web editors use Zustand for timeline state with derived atom patterns. Remotion uses React rendering per-frame. The industry consensus for complex editors: separate document state (what's in the timeline) from session state (where you are in the timeline). This maps directly to our problem: `EditorState` conflates these. Source: dev.to/asmaa-almadhoun/from-context-to-redux-to-zustand-18o9.

---

## 5. Options Considered

### Option A: Status Quo — Do Nothing

Leave `useEditorLayoutRuntime` and the current prop-drilling architecture in place.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — no migration effort |
| Performance | Poor — EditorContext causes full subtree re-renders on every state change (playhead ticks at 60fps) |
| Reliability | Current — works, no regression risk |
| Cost | Zero engineering time now, high future cost per feature |
| Reversibility | N/A |
| Stack fit | Current state — no alignment needed |
| Team readiness | N/A |

**Risks:** Every new feature adds to the god hook. Debugging becomes harder with scale. The editor is the core product feature — this debt compounds fast.

---

### Option B: Extend EditorContext — Minimal coupling fix

Add all runtime values (transport, clipActions, autosave status, dialog states, etc.) into `EditorContext`. Components consume context directly instead of receiving props. Keep `useEditorLayoutRuntime` as the setup function that populates the context.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — context extension, no structural change |
| Performance | Worse — single context, all consumers re-render on playhead tick |
| Reliability | Low risk — additive change |
| Cost | 1–2 days |
| Reversibility | Easy to revert |
| Stack fit | Extends existing pattern |
| Team readiness | No new concepts |

**Risks:** Playhead ticks (60fps) will re-render every context consumer. `Inspector`, `LeftPanel`, and `Timeline` will all re-render 60 times/second even when not playing, just because `currentTimeMs` is in the context. This makes performance worse, not better. The god hook still exists — it just moves from prop-drilling to context pollution.

---

### Option C: Domain Context Split — Recommended

Split `EditorState` into three domains. Provide each via its own context. Delete `useEditorLayoutRuntime`. Each domain hook self-registers into its context. Components consume exactly the context slice they need.

**Domain split:**

| Context | State | Update frequency |
|---------|-------|-----------------|
| `EditorDocumentContext` | tracks, title, fps, resolution, past/future, isReadOnly, editProjectId | On user edits |
| `EditorPlaybackContext` | currentTimeMs, isPlaying, playbackRate, durationMs, playheadMs | 60fps during playback |
| `EditorUIContext` | zoom, selectedClipId, clipboardClip, effectPreview, pendingAdd, selectedTransitionKey, mediaActiveTab, showExport, publishDialogOpen | On user interaction |
| `EditorPersistContext` | isDirty, isSavingPatch, lastSavedAt, `saveService.flushNow()` | On save events |
| Existing: `AssetUrlMapContext` | assetUrlMap | On project load/asset resolve |

**`SaveService` interface:**
```ts
interface SaveService {
  flushNow(): Promise<void>;
  cancelPending(): void;
}
```
Transport, keyboard, and mutations call `saveService.flushNow()` — no ref access.

**New component structure:**
```
EditorLayout
  EditorDocumentProvider (owns reducer + document dispatch)
    EditorPlaybackProvider (owns playhead state)
      EditorUIProvider (owns all view state)
        EditorPersistProvider (owns autosave, exposes SaveService)
          EditorHeader        ← consumes DocumentContext + PersistContext
          EditorWorkspace
            LeftPanel         ← consumes UIContext
            PreviewArea       ← consumes PlaybackContext
            CaptionLayer      ← new: caption logic extracted
            Inspector         ← consumes DocumentContext + UIContext
          TimelineSection     ← consumes DocumentContext + PlaybackContext + UIContext
          EditorDialogs       ← consumes UIContext + PersistContext
```

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — structural change across ~15 files |
| Performance | Good — playhead updates only re-render PlaybackContext consumers |
| Reliability | Medium risk — testable phase by phase |
| Cost | 4–6 days engineering |
| Reversibility | Moderate — context split is directional |
| Stack fit | Pure React, no new dependencies |
| Team readiness | React context is well-understood |

**Risks:**
- Context provider nesting 4 deep is verbose but manageable with a single `EditorProviders` wrapper component.
- Cross-domain actions (e.g., clip operation that also resets playhead) require dispatching to two contexts — mitigated by keeping playhead reset in the document reducer's `LOAD_PROJECT` handler.

---

### Option D: Zustand Migration — Powerful but premature

Migrate all editor state to Zustand stores. Domain slices: `useDocumentStore`, `usePlaybackStore`, `useUIStore`. Components use selectors: `const tracks = useDocumentStore(s => s.tracks)`.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — full state layer replacement |
| Performance | Excellent — selector-level subscriptions, ~2-5ms render on 500 components vs 85-150ms with context |
| Reliability | High risk — complete rewrite of state layer |
| Cost | 8–12 days |
| Reversibility | Hard |
| Stack fit | Requires new dependency; current stack is context-first |
| Team readiness | Zustand is not currently used in this codebase |

**Risks:** Introduces an architectural divergence from the rest of the app (which uses TanStack Query + React context). Zustand is the right future direction but is better done after the domain split (Option C) validates the boundaries.

---

## 6. Recommendation

**We recommend Option C: Domain Context Split.**

Over status quo: the editor's re-render behavior is already visible (every context consumer re-renders on playhead ticks during playback). This gets worse as we add panels.

Over Option B: Extending the existing monolithic context makes the performance problem worse, not better. Flooding 60fps updates into a single context that 8+ components consume is counterproductive.

Over Option D (Zustand): The coupling problem and the performance problem are orthogonal. Option C fixes coupling with a one-way door: if we later migrate to Zustand, the domain boundaries established in C map directly to Zustand stores. The migration becomes additive, not a rewrite.

**Key assumptions:**
1. The reducer logic (clip-ops, track-ops, session-ops) stays unchanged — only state shape delivery changes.
2. `EditorContext`'s current consumers (`Timeline`, `Inspector`) become domain-context consumers without behavior change.
3. The `SaveService` abstraction is sufficient to decouple transport/keyboard from autosave internals.

**Conditions that would change the recommendation toward Option D:**
- Observable frame drops during playback on real content (>4 tracks, 10+ clips). This would indicate context re-renders are hitting the performance floor.
- A second major feature area needs the same state (e.g., a sidebar editor panel or mobile editor).

---

## 7. Implementation Plan

Each phase leaves the editor in a fully functional state. No phase breaks existing behavior.

---

### Phase 1: Split EditorState by domain — 1.5 days

**Goal:** Separate the single `EditorState` type into three types without changing the reducer logic or hook wiring. This is a pure type refactor that makes domain boundaries explicit.

**Deliverables:**
- [ ] Create `EditorDocumentState`: `{ editProjectId, title, durationMs, fps, resolution, tracks, clipboardClip, clipboardSourceTrackId, past, future, isReadOnly }`
- [ ] Create `EditorPlaybackState`: `{ currentTimeMs, isPlaying, playbackRate, zoom }`
- [ ] Create `EditorUIState`: `{ selectedClipId, exportJobId, exportStatus }`
- [ ] Update `EditorState` = `EditorDocumentState & EditorPlaybackState & EditorUIState` (union shape, no behavioral change)
- [ ] Update all action types to tag which domain they affect (`domain: "document" | "playback" | "ui"`)
- [ ] TypeScript compiles with `bun run type-check`

**Dependencies:** None — this is an additive type change.

**Risks:** Action type tags are informational only at this phase — no runtime behavior changes. Low risk.

**Rollback:** Revert the type changes — no runtime impact.

---

### Phase 2: Create domain providers + SaveService — 2 days

**Goal:** Create the four context providers and the `SaveService` abstraction. Wire them into `EditorLayout` alongside the existing `EditorContext`. At the end of this phase, both the old context and new contexts exist — old prop-drilling unchanged.

**Deliverables:**
- [ ] Create `context/EditorDocumentContext.tsx` — provides document state slice + document dispatch functions
- [ ] Create `context/EditorPlaybackContext.tsx` — provides playback state + playback setters
- [ ] Create `context/EditorUIContext.tsx` — provides UI state + UI setters (moves all `useState` out of `useEditorLayoutRuntime`)
- [ ] Create `context/EditorPersistContext.tsx` — provides `{ isDirty, isSavingPatch, lastSavedAt, saveService }`
- [ ] Create `services/SaveService.ts` — wraps `flushSave` and `saveTimerRef` behind `{ flushNow(), cancelPending() }`
- [ ] Create `components/layout/EditorProviders.tsx` — nests all 4 providers + existing `AssetUrlMapContext`
- [ ] Replace `EditorLayout`'s provider nest with `EditorProviders`
- [ ] `bun run type-check` passes; `bun test` passes

**Dependencies:** Phase 1 (domain types).

**Risks:** Provider nesting order matters — `EditorDocumentContext` must wrap `EditorPlaybackContext` because playback reads `durationMs` from document. Test by opening editor and verifying all features work.

**Rollback:** Remove `EditorProviders` wrapper, restore direct provider nesting in `EditorLayout`.

---

### Phase 3: Migrate components to domain contexts — 1.5 days

**Goal:** Delete prop-drilling. Every component reads from context directly. `useEditorLayoutRuntime` is deleted.

**Migration order (least-risky first):**

1. `EditorStatusBar` — reads `isDirty`, `isSavingPatch`, `lastSavedAt` from `EditorPersistContext`
2. `EditorDialogs` — reads dialog open states from `EditorUIContext`, `saveService` from `EditorPersistContext`
3. `Inspector` — already uses `EditorContext`; add `EditorUIContext` for `effectPreview`; remove props
4. `TimelineSection` — reads from `EditorDocumentContext` + `EditorPlaybackContext` + `EditorUIContext`; remove all drilled props
5. `PreviewArea` — reads from `EditorPlaybackContext`; removes playback props
6. `LeftPanel` — reads from `EditorUIContext` for `mediaActiveTab`, `pendingAdd`
7. `EditorHeader` — reads from `EditorDocumentContext` + `EditorPersistContext`
8. `EditorWorkspace` — stripped to layout shell + caption orchestration (see Phase 4)

**Deliverables:**
- [ ] Each component above imports from domain context, not from props
- [ ] `EditorLayout` no longer distributes runtime values as props
- [ ] `useEditorLayoutRuntime.ts` deleted
- [ ] All props interfaces for migrated components updated (props count drops dramatically)
- [ ] `bun run type-check` + `bun test` pass

**Dependencies:** Phase 2.

**Rollback:** Restore props + `useEditorLayoutRuntime`. Because Phase 2 kept the old wiring intact, rollback is a prop-restore, not a behavior change.

---

### Phase 4: Extract CaptionLayer from EditorWorkspace — 1 day

**Goal:** Remove caption orchestration from `EditorWorkspace`. Create a `CaptionLayer` component that owns caption state internally.

**Deliverables:**
- [ ] Create `components/preview/CaptionLayer.tsx` — encapsulates `captionBitmapQueueRef`, `activeCaptionClipId`, `pendingCaptionRenderTimeRef`, `useCaptionCanvas`, `useCaptionDoc`, `useCaptionPresets`, and the `<canvas aria-hidden>` element
- [ ] `CaptionLayer` accepts `previewRef` to call `previewRef.current.receiveFrame` / `engine.setCaptionFrame`
- [ ] `EditorWorkspace` renders `<CaptionLayer previewRef={previewRef} />` and removes all caption-related state and effects
- [ ] `EditorWorkspace` is now: layout shell + `usePreviewEngine` call + renders `LeftPanel`, `PreviewArea`, `CaptionLayer`, `Inspector`
- [ ] `bun run type-check` + `bun test` pass

**Dependencies:** Phase 3.

**Rollback:** Move caption code back into `EditorWorkspace`.

---

### Phase 5: Split EditorRoutePage — 0.5 days

**Goal:** `EditorRoutePage` currently serves as both the project list UI and the editor container. Split them.

**Deliverables:**
- [ ] Create `components/layout/EditorProjectList.tsx` — all project list UI, `ProjectCard`, `groupByVersion`, mutations for create/delete/openInChat
- [ ] `EditorRoutePage` becomes a thin router: if `activeProject`, render `EditorLayout`; else render `EditorProjectList`
- [ ] `EditorRoutePage.tsx` drops from ~560 lines to ~40 lines
- [ ] `bun run type-check` + `bun test` pass

**Dependencies:** None — independent of Phases 1–4, can run in parallel.

**Rollback:** Merge files back.

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Context provider order bug (playback reads stale durationMs) | Medium | High — wrong timeline length | Unit test `EditorPlaybackContext` with known `durationMs` before Phase 3 |
| 2 | `SaveService.flushNow()` race with in-flight mutation | Low | Medium — double-save | `SaveService` checks `isSavingPatch` ref before firing |
| 3 | Phase 3 component migration misses a prop pathway | Medium | Low — TypeScript catches it | Run `bun run type-check` after each component migration |
| 4 | CaptionLayer `previewRef` timing issue (caption renders before engine frame) | Low | Low — caption flicker | Keep same guard as current (`pendingCaptionRenderTimeRef`) |
| 5 | Playhead context re-renders visible during heavy edits | Low | Medium | Memoize PlaybackContext value; if still an issue, Zustand migration (Option D) |

---

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| God hook deleted | Lines in `useEditorLayoutRuntime.ts` | 152 | 0 (file gone) | `ls hooks/useEditorLayoutRuntime.ts` → not found |
| Prop drilling eliminated | Max props on any single component | ~30 (EditorWorkspace) | ≤5 | Count props interfaces |
| Domain isolation | Re-renders on playhead tick (Inspector, Header) | ~60/sec | 0/sec | React DevTools profiler, 10s playback |
| Autosave decoupling | Files that import `saveTimerRef` or `editorPublishStateRef` | 4 | 1 (SaveService only) | `grep -r saveTimerRef` |
| EditorWorkspace complexity | Lines in `EditorWorkspace.tsx` | 263 | ≤120 | `wc -l` |
| EditorRoutePage complexity | Lines in `EditorRoutePage.tsx` | 559 | ≤50 | `wc -l` |

**Leading indicators (during migration):**
- TypeScript compiles after every phase
- No new test failures
- Editor opens, edits, saves, and closes without console errors

**Lagging indicators (after all phases):**
- Adding a new inspector panel requires editing ≤2 files (was ≥5)
- Adding a new dialog requires editing ≤2 files (was ≥4)

---

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Should `EditorPlaybackContext` own `playheadMs` (smoothed) separately from `currentTimeMs` (store)? Currently both exist as separate values with a sync effect. | Ken | Phase 2 start | Open |
| 2 | Does `useEditorProjectPoll` belong in `EditorDocumentContext` or stay as a standalone hook initialized in `EditorLayout`? | Ken | Phase 2 start | Open |
| 3 | Should `selectedTransitionKey` stay as a `[trackId, clipAId, clipBId]` tuple or be resolved to `Transition | null` at the context level? | Ken | Phase 3 start | Open |

---

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Option B: Extend EditorContext | Makes performance worse by adding 60fps playhead ticks to an already-monolithic context |
| Option D: Zustand migration | Valid long-term direction but premature — Option C establishes domain boundaries that Zustand can adopt without a domain redesign |
| Rewriting the reducer | Reducer logic is correct and split well; the problem is delivery, not computation |
| Moving state to TanStack Query | Server state tool, not editor session state — wrong abstraction for in-memory timeline edits |
