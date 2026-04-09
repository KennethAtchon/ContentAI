# Preview Stage Rearchitecture — Plan

> **Date:** 2026-04-08
> **Status:** Draft
> **Deciders:** Editor product owner, frontend lead, design/UX owner

## 1. Problem Statement

The current editor preview is not structured like a modern direct-manipulation stage. `PreviewArea` in `frontend/src/features/editor/components/PreviewArea.tsx` is a render surface, playback synchronizer, media mounting policy, overlay renderer, and preview layout manager all at once. While playback runs, `usePlayback` in `frontend/src/features/editor/hooks/usePlayback.ts` advances `currentTimeMs` with `requestAnimationFrame`, which updates reducer state every frame and causes the preview path to reconcile at roughly display refresh rate. At the same time, the preview mounts media within a 30,000ms window and enables heavy preload within a 12,000ms window via `frontend/src/features/editor/utils/editor-composition.ts`, so dense timelines can keep many decoders and DOM nodes alive simultaneously. On the editing side, visual transforms are just scalar fields (`positionX`, `positionY`, `scale`, `rotation`) stored on clips in `frontend/src/features/editor/types/editor.ts` and mostly changed through the inspector in `frontend/src/features/editor/components/inspector/InspectorClipVisualPanel.tsx`. That makes the preview feel unlike other editors: users cannot grab visible objects, resize them, or align them naturally on-canvas. More importantly, the current component boundary is itself part of the problem: `PreviewArea` is already a god object, and continuing to evolve it would deepen coupling and make the next generation of preview harder to reason about. This initiative should replace that workflow rather than preserving it.

## 2. Goals & Non-Goals

**Goals**

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Make preview objects directly manipulable | Active visual clips render with selection chrome, drag handles, resize handles, rotation, and snapping on the preview itself |
| 2 | Decouple playback/rendering from the global React editor tree | Playing the timeline no longer causes broad editor re-rendering every frame |
| 3 | Scale to dense timelines more predictably | Preview performance degrades gracefully as clip count rises because mount, preload, and sync policies are bounded and observable |
| 4 | Preserve export correctness | The visual model used for preview and interaction stays logically aligned with backend validation, persistence, sync logic, and export timing/transforms |
| 5 | Create a foundation for future features | Multi-select, alignment guides, safe areas, responsive layouts, templates, and richer transforms can build on the new stage model without another rewrite |
| 6 | Eliminate preview god objects | The new preview system is split into small, single-purpose modules with clear contracts and no central “do everything” component |

**Non-Goals**

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Rewrite the entire export pipeline in this initiative | Export parity matters, but preview rearchitecture should not block on replacing FFmpeg or the full render stack end-to-end |
| 2 | Ship a full Figma-style infinite canvas | The editor still targets a bounded video frame and timeline-first workflow |
| 3 | Introduce collaborative editing in preview | Multiplayer semantics add large state/merge complexity unrelated to the immediate problem |
| 4 | Replace every media pipeline with WebGL/WebGPU on day one | A full renderer rewrite is high-risk and not required to unlock draggable/resizable stage objects |
| 5 | Remove numeric inspector controls | Inspector fields remain useful for precision entry after direct manipulation ships |
| 6 | Preserve `PreviewArea` as the primary architecture | The current preview flow is considered legacy and will be replaced, not expanded |

## 3. Background & Context

Today’s preview is derived entirely from the editor reducer state. `EditorWorkspace` passes `tracks`, `currentTimeMs`, `isPlaying`, `playbackRate`, and `resolution` directly into `PreviewArea`. `PreviewArea` then computes active clips, mounts `<video>` and `<audio>` elements, applies transition styles, and uses effects to seek and play/pause every mounted media element as `currentTimeMs` changes. Text clips are positioned with CSS transforms and caption rendering is delegated to `useCaptionCanvas`, which also depends on `currentTimeMs`.

The clip model reflects this architecture. Visual clips have basic transform fields, but there is no persistent concept of a stage object, anchor box, transform origin, bounds, snapping metadata, or interaction state. Selection is clip-centric in the reducer (`selectedClipId`), not stage-centric. The timeline has more direct manipulation sophistication than the preview: `TimelineClip.tsx` already performs pointer-driven drag and trim interactions locally, mutating DOM styles during drag and committing once on release. The preview does not have an equivalent interaction runtime. Architecturally, preview logic is concentrated rather than composed, which makes individual concerns hard to test, swap, or optimize independently.

There are several constraints we should preserve. First, timing rules already exist and are shared in `editor-composition.ts`, and ADR-009 (`docs/adr/ADR-009-editor-playback-preview.md`) documents how timeline time maps onto HTML media elements. Second, the store is reducer-based with history snapshots, so any high-frequency interaction path that dispatches per-pointer-move into the reducer will regress performance and bloat undo history. Third, preview correctness must stay close to export behavior even if the implementation path differs, which means frontend geometry changes cannot be planned in isolation from backend schemas, sync logic, and export mapping. Fourth, the editor already has existing clip types for video, audio, text, and captions, so the new stage model should layer on top of these rather than forcing a destructive schema reset.

The forcing function is both product and technical. Product-wise, the current preview interaction model is behind user expectations for video editors. Technical-wise, the current architecture makes even straightforward preview work expensive because playback, render derivation, and UI state are all coupled.

## 4. Research Summary

**Per-video-frame browser synchronization**
- MDN and web.dev both document `HTMLVideoElement.requestVideoFrameCallback()` as the browser primitive for frame-synchronous video work. The key insight is that it runs at the lower of the video frame rate and browser paint rate, which is a better fit than using a generic 60Hz React-driven render loop for media sync.
- This does not eliminate all main-thread work, but it gives us a way to build a preview runtime that reacts to actual decoded frames instead of invalidating the React tree on every timeline tick.
- Sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
  - https://web.dev/articles/requestvideoframecallback-rvfc
  - https://caniuse.com/mdn-api_htmlvideoelement_requestvideoframecallback

**Retained-scene interaction patterns**
- Moveable’s docs and package surface show a mature interaction model for draggable, resizable, scalable, rotatable, snappable targets with control boxes and group operations. We do not need to adopt it blindly, but it is strong evidence that direct-manipulation chrome should be separated from persisted document state.
- The main insight is that “selectable target + transient control box + commit-on-end” is a better mental model than “continuously patch reducer state while dragging.”
- Sources:
  - https://daybrush.com/moveable/release/latest/doc/
  - https://github.com/daybrush/moveable

**Canvas/stage performance guidance**
- Konva’s performance guidance repeatedly reduces to two rules: compute as little as possible and draw as little as possible. It also emphasizes limiting stage size, minimizing layer count, and refreshing only the layers that changed.
- The useful takeaway for our redesign is architectural rather than library-specific: preview should have explicit layer boundaries and should avoid reprocessing the whole scene when only selection chrome or one object transform is changing.
- Sources:
  - https://konvajs.org/docs/performance/All_Performance_Tips.html

**How high-scale editors separate UI from rendering**
- Figma’s engineering posts describe an architecture where the editor renderer is distinct from the React UI, and they call out unnecessary UI re-rendering as a concrete source of frame loss. Their older renderer article also explains why teams building high-fidelity editors often outgrow DOM-as-the-renderer for the whole system.
- The key insight for us is not “rewrite everything in WebGL now.” It is that editor chrome and application UI should not sit on the same hot path as viewport updates and scene transforms.
- Sources:
  - https://www.figma.com/blog/improving-scrolling-comments-in-figma/
  - https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/
  - https://www.figma.com/blog/figma-rendering-powered-by-webgpu/

## 5. Options Considered

**Option A: DOM-based stage runtime with isolated preview store and interaction layer**

Introduce a new preview runtime that derives a stage scene graph from clips, keeps render-synchronization and transient interaction state local to the preview, and overlays direct-manipulation controls on active stage objects. Media can remain HTML `<video>`/`<audio>` elements initially, but stage selection, dragging, resizing, snapping, and transient transforms live in a dedicated runtime rather than the main reducer. Commits back to reducer happen at semantic boundaries such as drag end, resize end, nudge, or explicit timeline changes.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium to high |
| Performance | Strong improvement because hot playback state and transient interaction state are removed from broad React reconciliation |
| Reliability | Moderate risk; requires careful preview/export parity work and staged migration |
| Cost | Meaningful engineering investment but still smaller than a full renderer rewrite |
| Reversibility | Moderate; can be feature-flagged and rolled back screen-by-screen |
| Stack fit | Good fit with existing clip types, reducer history, and HTML media playback |
| Team readiness | Good if scoped into phases with clear interfaces |

Risks: duplicated state between reducer and stage runtime can drift if contracts are sloppy; resize semantics for different clip types may expose model gaps; DOM/CSS transform behavior can still get expensive with many active layers. Likelihood is medium, but manageable with a scene-graph boundary and instrumentation.

Open questions: do we store width/height/anchor explicitly or derive from source dimensions and scale? Should selection be preview-first, timeline-first, or unified? What file/module boundaries keep the runtime decomposed instead of recreating a god object under a new name?

**Option B: Full custom canvas/WebGL/WebGPU renderer and interaction engine**

Replace the DOM-centered preview with a custom render pipeline that composites media, text, and controls through canvas/WebGL/WebGPU, similar in spirit to professional design tools. Direct manipulation, snapping, and overlays are all part of the custom renderer.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Very high |
| Performance | Highest theoretical ceiling |
| Reliability | High delivery risk and broad blast radius |
| Cost | Highest engineering cost by far |
| Reversibility | Low; once deep investment starts, backing out is expensive |
| Stack fit | Mixed; powerful long-term fit, heavy short-term mismatch with current app architecture |
| Team readiness | Unclear unless the team already has rendering-engine expertise |

Risks: project duration expands dramatically; browser/media edge cases multiply; export parity gets harder, not easier; foundational work may delay user-visible gains for months. Likelihood is high because we would be taking on renderer engineering, interaction engineering, and media pipeline engineering at once.

Open questions: can we realistically staff and test this? Do we need GPU compositing now, or are we solving for a future scale we do not yet have?

## 6. Recommendation

**We recommend Option A: DOM-based stage runtime with isolated preview store and interaction layer.**

This is the best fit because it solves the actual product problem, not just the current lag symptoms, while also giving us the architectural reset you want. We should not preserve `PreviewArea` as the core implementation and keep piling behavior into it. Instead, we should replace it with a preview subsystem made of small modules: scene derivation, playback runtime, media registry, stage interaction layer, overlay/guides layer, and commit adapters back to editor state. Compared with a full renderer rewrite, this gets us to a shippable direct-manipulation editor much faster while preserving the ability to adopt canvas/WebGL for specific layers later if needed.

The recommendation depends on a few assumptions. We assume HTML media elements remain adequate for first-generation preview composition if we sharply reduce unnecessary mounts and React-driven sync work. We assume the team can add a stage scene model without breaking existing reducer/history behavior by treating interaction changes as transient until commit. We also assume export parity can be maintained by defining a single transform contract shared by preview and export mappings.

We would change this recommendation if one of three things becomes true: first, if dense real-world projects still miss responsiveness targets after preview/runtime decoupling; second, if DOM-based transforms prove too inconsistent for resize/crop/rotate semantics across browsers; third, if product scope expands quickly into effects and compositing that naturally require a GPU renderer.

## 7. Implementation Plan

### Architectural rules for the replacement

The replacement preview system should follow these design rules:

- No single file owns rendering, playback, interaction, media lifecycle, and overlays at the same time.
- Scene derivation is pure and testable.
- The editor reducer remains the source of truth for document state, transport intent (`isPlaying`, playback rate, explicit seek position), timeline UI, and all non-preview consumers that already depend on `currentTimeMs`.
- The preview subsystem owns a local render clock used for frame-synchronous media sync and transient stage interaction work.
- The preview shell publishes semantic playhead updates back to editor state on bounded events such as explicit seek, scrub, play/pause toggles, keyboard stepping, interaction commit, and throttled playback checkpoints instead of every paint frame.
- Interaction state is transient and isolated from persisted document state until commit.
- Media mounting/preload policy lives in its own module with observable counters.
- Selection chrome, guides, and handles are separate from media rendering.
- Every cross-boundary contract is explicit: scene model, geometry model, transport/playhead contract, preview render clock, and commit API.
- Geometry changes do not ship unless frontend types, backend validation, persistence, sync logic, and export mapping are updated together behind one contract.
- During rollout we prefer short-lived implementation flags, but we do not preserve long-term compatibility layers or dual schemas; once a phase is accepted, the old path is deleted.

Suggested package shape:

- `preview-root/` for composition shell only
- `scene/` for clip-to-stage derivation
- `runtime/` for playback clock, active-window calculation, and media sync
- `renderers/` for video, text, caption, and overlay renderers
- `interaction/` for hit-testing, drag/resize/rotate, snapping, and selection state
- `state/` for local preview store and reducers
- `adapters/` for editor-store integration and export mapping helpers
- `metrics/` for instrumentation and debug panels

**Phase 0: Instrument and define the target stage contract**

Goal: establish measurable baselines and define the scene model plus transport/export contracts before implementation spreads through the codebase.

Done criteria:
- Instrument preview with metrics for mounted media count, heavy-preload count, sync work duration, and React commit duration during playback.
- Define a `StageObject` model for visual clips with persistent geometry and transient interaction fields.
- Decide how existing `positionX`, `positionY`, `scale`, and `rotation` map into the new geometry contract.
- Define a transport contract that separates editor playhead ownership from preview render-clock ownership.

Deliverables:
- [ ] Performance measurement plan and lightweight telemetry hooks
- [ ] Stage data model proposal
- [ ] Transport/playhead ownership doc
- [ ] Geometry/export parity mapping doc
- [ ] Preview module boundary map and ownership rules

Dependencies: none.

Risks and detection:
- Risk: we choose geometry semantics that do not work for text and video consistently.
- Detect by validating against representative video, text, and caption examples before Phase 1 begins.
- Risk: playhead ownership stays ambiguous and we move frame churn instead of removing it.
- Detect by documenting every current `currentTimeMs` consumer and assigning each one to either editor transport state or preview render state before Phase 1 begins.

Rollback plan: keep all instrumentation behind dev/debug flags and make no user-facing behavior changes in this phase.

**Phase 1: Replace `PreviewArea` with a thin preview shell and modular runtime**

Goal: retire `PreviewArea` as the core implementation and replace it with a thin composition shell over modular preview subsystems.

Done criteria:
- Preview can play and scrub without broad editor re-rendering every frame.
- The old `PreviewArea` workflow is no longer the active implementation path.
- The new preview entrypoint is a thin shell around separately owned runtime, scene, renderer, and interaction modules.
- Media sync is driven by local refs/runtime clocks, using `requestVideoFrameCallback()` where supported and a fallback path elsewhere.
- Timeline UI, keyboard transport, and thumbnail/export-adjacent consumers still receive a coherent editor playhead without subscribing the full editor tree to preview paint frequency.

Deliverables:
- [ ] Local preview runtime store with render clock, active objects, and mounted media set
- [ ] Thin preview shell component
- [ ] Scene derivation module
- [ ] Media registry module
- [ ] Refactored media sync loop
- [ ] Bounded mount/preload policy with adaptive windows instead of fixed broad windows
- [ ] Transport bridge that maps reducer intent into preview runtime and emits bounded semantic playhead updates back out

Dependencies: Phase 0 scene contract.

Risks and detection:
- Risk: preview clock drifts from timeline state.
- Detect by comparing preview object time against reducer playhead during automated scrubbing tests and manual verification.
- Risk: non-preview consumers such as timeline scroll, keyboard stepping, and thumbnail capture silently regress because they still depend on reducer playhead behavior.
- Detect with integration tests that exercise playback, seek, JKL stepping, and thumbnail capture after the new shell becomes active.

Cutover plan: keep a short-lived dev flag while Phase 1 is landing; once the new shell matches baseline playback and scrubbing behavior, delete the old `PreviewArea` path instead of preserving a permanent fallback.

**Phase 2: Introduce stage objects, selection chrome, and transient interaction state**

Goal: make active visual objects selectable and manipulable in preview without committing every pointer move into reducer history.

Done criteria:
- Active video and text objects render selection outlines and handles.
- Drag, resize, and rotate interactions update a transient stage state at pointer frequency and commit semantic patches on interaction end.
- Inspector remains in sync with selected object after commit.

Deliverables:
- [ ] Stage overlay and hit-testing layer
- [ ] Direct manipulation controller
- [ ] Interaction-to-clip patch mapper
- [ ] Snap guides, safe area guides, and bounds constraints
- [ ] File-level guardrails/tests to prevent interaction logic from collapsing back into renderer files

Dependencies: Phase 1 runtime split.

Risks and detection:
- Risk: reducer state and transient stage state diverge.
- Detect by adding commit/revert assertions and interaction integration tests.

Cutover plan: ship drag-only first if needed, but keep the inspector as a precision input path rather than a legacy architecture fallback.

**Phase 3: Expand geometry model and land the shared document contract**

Goal: move from today’s coarse transform fields to a stage model that can support real resize/stretch behavior while updating the shared frontend/backend document contract in lockstep.

Done criteria:
- Visual clips have explicit box semantics, not only translate/scale semantics.
- Different clip types have clear resize rules: text box resize versus media box resize/crop behavior.
- Frontend types, backend schemas, persistence, and sync logic all speak the same geometry shape.
- Export mapping remains correct for the supported transform subset.

Deliverables:
- [ ] Schema extension for bounds and anchor metadata
- [ ] Frontend `editor.ts` type update and reducer/editor action updates
- [ ] Backend `editor.schemas.ts`, timeline types, and persistence contract updates
- [ ] Sync-service update for geometry carry-forward semantics
- [ ] Export mapping update for the supported geometry subset
- [ ] Updated inspector UI for geometry editing

Dependencies: Phase 2 interaction layer.

Risks and detection:
- Risk: resize behavior feels wrong because “scale” and “box size” are conflated.
- Detect with design review and task-based usability sessions before default rollout.
- Risk: frontend geometry ships ahead of backend/export support and creates guaranteed preview/export mismatch.
- Detect by gating Phase 3 completion on fixture-based preview/export equivalence tests and end-to-end save/load/export validation.

Cutover plan: because this repo does not preserve long-term compatibility layers, land the new geometry contract in one coordinated change set, reset dev data if needed, and delete superseded legacy geometry handling after verification.

**Phase 4: Scale hardening, parity verification, and rollout**

Goal: make the new preview robust on dense timelines and replace the old implementation.

Done criteria:
- Preview meets performance targets on representative heavy projects.
- Old preview code path is deleted.
- Documentation and tests cover the new stage architecture.
- Preview/save/load/export parity is verified on representative fixtures for each supported clip type.

Deliverables:
- [ ] Stress-test fixtures
- [ ] Cross-browser verification
- [ ] Unit and interaction tests
- [ ] Save/load/export parity fixtures
- [ ] Updated ADR(s) for preview architecture

Dependencies: Phases 1-3.

Risks and detection:
- Risk: browser-specific media behavior breaks stage assumptions.
- Detect with targeted Chrome, Safari, and Firefox verification on real media assets.

Cutover plan: use a temporary rollout flag only while validating the final path, then remove the flag and delete dead code once acceptance criteria are met.

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Preview runtime and reducer drift out of sync | Medium | High | Make the stage runtime derived + transient, with explicit commit boundaries and invariant checks |
| 2 | New geometry model breaks export parity | Medium | High | Define one transform contract early and require fixture-based preview/save/load/export equivalence before rollout |
| 3 | DOM-based stage still struggles on very dense projects | Medium | Medium/High | Add instrumentation, virtualization, adaptive mount windows, and keep renderer abstraction clean for future GPU escalation |
| 4 | Resize semantics confuse users across clip types | Medium | Medium | Define clip-type-specific behavior and validate with design/usability review before rollout |
| 5 | Undo/redo becomes noisy or unintuitive | Medium | Medium | Commit only semantic interaction end states, not pointer-move deltas |
| 6 | Browser support gaps for `requestVideoFrameCallback()` create regressions | Low | Medium | Ship a tested fallback sync path and use feature detection |
| 7 | Team underestimates migration breadth | Medium | Medium | Phase the rollout, assign explicit frontend/backend/export owners, and avoid simultaneous full renderer replacement while still landing one shared geometry contract |
| 8 | The rewrite recreates a new god object under a different filename | Medium | High | Enforce package boundaries, keep shell components thin, and review against module ownership rules in Phase 0 |

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| Direct manipulation | Percentage of visual clip edits done via on-canvas interactions | 0% today | >70% of transform edits after rollout | Product analytics on transform edit source |
| Playback responsiveness | React commits involving editor workspace while playing | Preview path updates on roughly every playback frame today | Reduced by at least 80% during playback | React Profiler and local telemetry |
| Media pressure | Mounted video/audio elements in heavy projects | Up to all clips within +/-30s window today | Adaptive cap with project-type thresholds; fewer than current implementation on identical fixtures | Debug counters in preview runtime |
| Interaction smoothness | Pointer-move to visual update frame budget while dragging selected object | Not measured today | Median under 16ms on reference hardware | Performance instrumentation and manual traces |
| Usability | Time to reposition and resize a clip for common tasks | Inspector-driven, multi-step workflow today | At least 50% faster in usability task trials | Scripted task testing with internal users |
| Reliability | Preview/save/load/export transform mismatch bugs | Unknown | No Sev-1 issues during rollout; tracked mismatch rate below agreed threshold | Shared fixtures, QA verification, and bug tracking |

Leading indicators:
- Stage interactions work without reducer dispatch spam.
- Mounted media count drops on stress fixtures.
- Selection chrome and guides render without causing media jitter.

Lagging indicators:
- Users stop relying on numeric X/Y entry for routine placement.
- Heavy projects are playable and editable without complaint-driven regressions.

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Should media resize mean scale-only, crop-within-frame, or both via separate modes? | Design + frontend | Before Phase 2 | Open |
| 2 | What persistent geometry fields do we want long term: width/height, anchor, transform origin, crop rect, or some subset? | Frontend lead | Before Phase 3 | Open |
| 3 | Do captions become selectable stage objects or remain a specialized overlay for the first rollout? | Product + frontend | Before Phase 2 | Open |
| 4 | How should multi-select and alignment distribution fit into the first-stage architecture, even if not shipped immediately? | Frontend lead | Before Phase 2 | Open |
| 5 | Which browsers/devices define our performance acceptance bar? | Product owner | Before Phase 4 | Open |
| 6 | Which exact reducer consumers continue to read editor playhead time, and which move to preview-local render time? | Frontend lead | Before Phase 1 | Open |

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Keep evolving `PreviewArea` with tactical fixes | Preserves the very god-object architecture we are trying to leave behind and does not change the interaction model enough |
| Immediate full WebGL/WebGPU rewrite | Too much simultaneous technical and product risk for the current team/problem size |
