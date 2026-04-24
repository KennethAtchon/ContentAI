# Editor Migration — OpenReel Architecture

> Migrate ContentAI's editor backend logic to OpenReel's architecture while keeping the existing UI.
> Started: 2026-04-23.
> Owner: Kenneth.

---

## Goal

Rebuild the editor's engine layer (clock, compositor, captions, export, persistence wiring) to match OpenReel's design so preview hits 60 FPS and preview = export. UI stays visually identical; only the data flow underneath changes.

## Non-Goals

- No UI redesign. No new user-facing features.
- No backend (Hono/Drizzle) changes unless a bug is exposed during migration.
- No database schema changes.
- No production users exist → no backwards compatibility, no feature flags, no shims. Per `CLAUDE.md`: delete old code, update all call sites, reset DB if schema shifts.

## North Star (copy from OpenReel)

1. **Engine has zero React imports.** Lives in `frontend/src/editor-core/` with an ESLint rule forbidding React.
2. **Playback clock is AudioContext-driven, outside React state.** UI subscribes via `useSyncExternalStore`. Nothing pushes `currentTimeMs` into a reducer on every tick.
3. **One `renderFrame(project, t, w, h)` function.** Preview rAF loop and export loop both call it. Export ≡ preview.
4. **Captions are pure functions.** `renderCaptionFrame(subtitle, t) → Segment[]`, painted to the same canvas, no `createImageBitmap` round-trip, no React version counters.
5. **LRU frame cache with global budget.** 100 frames / 500 MB ceiling, preload ahead/behind the playhead.
6. **Thin bridges between engine and React.** One file per domain. React never constructs engines; it pulls handles from a single engine store.
7. **Rust deleted.** WASM compositor-descriptor builder removed; TS is sufficient. See `phases/phase-01-cleanse.md`.

## Structure of This Migration

Three stages, each composed of concrete phases:

| Stage | Purpose | Phases |
| --- | --- | --- |
| 1. Cleanse | Delete dead/duplicate/legacy code so the floor is clean | `phase-01-cleanse.md` |
| 2. Scaffold | Create empty but correctly-shaped structures: folders, interfaces, clock singleton, bridge skeletons, engine store | `phase-02-scaffold.md` |
| 3. Implement | Fill each subsystem in priority order | `phase-03-implement-clock.md`<br>`phase-04-implement-render-pipeline.md`<br>`phase-05-implement-frame-cache.md`<br>`phase-06-implement-captions.md`<br>`phase-07-implement-unified-export.md`<br>`phase-08-collapse-contexts.md`<br>`phase-09-autosave-and-persist.md`<br>`phase-10-cutover-and-delete-old.md` |

Each phase file has: goal, preconditions, files touched, step-by-step plan, validation, exit criteria, rollback, estimate.

## Stage Contract

- **Cleanse:** After stage 1, editor still runs and looks identical. No behavior change. Only code removed.
- **Scaffold:** After stage 2, editor still runs. New folders exist and are reachable from `features/editor/` but are no-ops. Old engine still in charge.
- **Implement:** Each implement-phase swaps ONE subsystem from old → new. Editor must build and open after every phase. No "big bang" cutover until phase 10.

## Execution Rules (strict)

1. **One phase per branch, one PR per phase.** No multi-phase PRs.
2. **No phase merges without:** (a) `bun run type-check` clean, (b) `bun run lint` clean, (c) `bun test` green, (d) manual smoke: open project → play → scrub → edit clip → save → export.
3. **If a phase exceeds its estimate by 1.5×, stop and re-plan.** Don't push through.
4. **Each phase keeps the editor working.** If mid-phase state would break the editor, split the phase.
5. **Delete the old code at the end of the phase that replaces it.** No "keep for reference" files. No `.old.ts`. No `@deprecated`.
6. **Perf budgets are enforced after each implement phase.** See `phases/perf-budgets.md` once written, or inline in each phase.

## Dockerfile Constraint

Prod image builds only from `frontend/` and `backend/`. No monorepo expansion. Engine lives at `frontend/src/editor-core/` — a sibling of `frontend/src/features/`, not a separate package. ESLint enforces the boundary. See `phases/phase-02-scaffold.md` §3.

## Perf Targets (end of stage 3)

| Metric | Current | Target |
| --- | --- | --- |
| Preview FPS (1080p, ≤10 clips) | 5–10 | 60 |
| Rerenders in 10s playback (preview subtree) | ~300 | ≤ 20 |
| Main-thread ms / frame | ~31 | ≤ 10 |
| Preview ↔ export pixel parity | diverges | byte-identical (pre-encode) |
| Memory steady-state (1-hour timeline) | unbounded growth | ≤ 500 MB |

## Current State Quick Facts

- Engine is inside `frontend/src/features/editor/engine/` (not isolated).
- `PreviewEngine.ts` is 1083 lines; publishes playhead to React every 250 ms.
- `CompositorWorker.ts` is 712 lines; per-clip frame queues, no LRU.
- Rust/WASM = `frontend/src/features/editor/wasm/` + `engine/editor-core-wasm.ts`. Only consumer = `buildCompositorDescriptorsWithRust` in `PreviewEngine.ts` and `services/client-export.ts`. Pure timeline math. JS equivalent already exists (`buildCompositorClips`).
- Empty dirs (legacy refactor stubs): `renderers/`, `scene/`, `preview-root/`.
- Two context folders: `context/` (8 files) and `contexts/` (1 file `asset-url-map-context.ts`). Will consolidate into `context/`.
- Captions: `frontend/src/features/editor/caption/` + hidden `CaptionLayer.tsx` canvas → `createImageBitmap` → version bump. Needs flattening.
- Client-side export exists in `services/client-export.ts` (760 lines). Duplicates preview render logic. Merge into unified `renderFrame`.
- Undo/redo is action-based reducer (`model/editor-reducer.ts` + 4 splits). Keep.

## Reference Docs

- `docs/research/openreel-rendering-architecture.md` — OpenReel internals
- `docs/research/openreel-vs-contentai-why-slow.md` — head-to-head + smoking-gun citations
- `docs/plans/editor-unified-architecture.md` — earlier planning doc (superseded by this migration)
- `docs/architecture/domain/editor-preview-rendering-flow.md` — current flow diagram
- `docs/bugs/issues.md`, `docs/bugs/dump.md` — known issues
- OpenReel source: `/Users/ken/Documents/workspace/openreel/openreel-video`

## Checklist — Mark as You Go

- [ ] Phase 1 — Cleanse
- [ ] Phase 2 — Scaffold
- [ ] Phase 3 — Clock + playhead decoupling
- [ ] Phase 4 — Unified render pipeline
- [ ] Phase 5 — LRU frame cache
- [ ] Phase 6 — Pure-function captions
- [ ] Phase 7 — Unified export (preview ≡ export)
- [ ] Phase 8 — Context collapse
- [ ] Phase 9 — Autosave + persistence on engine store
- [ ] Phase 10 — Cutover + delete old engine
