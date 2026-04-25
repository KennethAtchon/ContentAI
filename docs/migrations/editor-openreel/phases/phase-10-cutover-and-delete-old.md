# Phase 10 — Cutover + Delete Old Engine

> Final sweep. Ensure no lingering references to the old architecture. Delete what's left. Lock the boundary.
> After this phase: migration is complete. The editor runs entirely on the OpenReel-style architecture.

## Goal

1. Nothing in `features/editor/` imports from a now-defunct path.
2. `features/editor/engine/` is empty (or gone).
3. Final perf benchmark passes against phase targets.
4. Documentation updated: `CLAUDE.md` reflects the new structure; `docs/architecture/domain/editor-preview-rendering-flow.md` rewritten to the new flow.
5. ADR written capturing the before/after.

## Preconditions

- Phases 1–9 all merged.
- Editor fully functional on new architecture.

## Files Touched

### Delete
- `frontend/src/features/editor/engine/PreviewEngine.ts` — already deleted in phase 4, verify
- `frontend/src/features/editor/engine/AudioMixer.ts` — move into `editor-core/audio/AudioMixer.ts` if still in use; delete from engine/
- `frontend/src/features/editor/engine/` — should be empty now; `rmdir`
- Any remaining stale types: `frontend/src/features/editor/types/editor-playback.ts` if obsolete
- Any tests referencing deleted files

### Modify
- `CLAUDE.md` — update the "Editor System" section:
  - Engine lives at `frontend/src/editor-core/`, React-free (ESLint-enforced)
  - State lives in 4 Zustand stores (`projectStore`, `uiStore`, `playbackStore`, `engineStore`). No React contexts for state.
  - Every component read uses a selector. Lint-enforced.
  - Undo/redo is action-based via `ActionExecutor` in `editor-core/timeline/`. 200-action cap.
  - Playback clock is `MasterTimelineClock`, AudioContext-driven, outside React state.
  - `VideoEngine.renderFrame()` is the single render entry used by preview and export.
  - Captions are pure functions painted inline.
  - Autosave runs in a worker.
- `docs/architecture/domain/editor-preview-rendering-flow.md` — rewrite. Delete old flow diagrams; produce a new Mermaid reflecting editor-core + bridges + stores.
- `docs/architecture/overview.md` — update if it referenced the old structure.
- `docs/plans/editor-unified-architecture.md` — mark superseded by this migration; link to `docs/migrations/editor-openreel/`.

### Add
- `docs/adr/NNNN-editor-openreel-migration.md` — short ADR (context, decision, consequences, status)
- Perf benchmark script (optional but recommended): `frontend/scripts/benchmark-editor.ts` — spin up a known project, render N frames, measure FPS. Wire to CI later.

## Step-by-Step

1. Branch `migration/phase-10-cutover`.
2. Grep for old names — must return no hits outside docs:
   - `PreviewEngine`
   - `useEditorAutosave`
   - `EditorPlaybackContext` / `EditorDocumentStateContext` / any other `Editor*Context`
   - `useEditorStore` / `useEditorReducer`
   - `editorReducer` / `editor-reducer-*`
   - `INITIAL_EDITOR_STATE`
   - `snapshotEditorState`
   - `useCaptionCanvas`
   - `CaptionLayer`
   - `buildCompositorDescriptorsWithRust`
   - `editor-core-wasm`
   - `REACT_PUBLISH_INTERVAL_MS`
   - `publishTimeUpdate`
3. Delete stragglers.
4. Update `CLAUDE.md` editor section.
5. Rewrite `docs/architecture/domain/editor-preview-rendering-flow.md`.
6. Write ADR.
7. Run full perf benchmark, capture numbers:
   - Playback FPS on 3-clip 1080p project
   - Playback FPS on 10-clip 1080p project with captions
   - Scrub latency p95
   - Memory steady-state after 1h
   - Export time for 30s project
   - React commits during 10s playback
   Record in the ADR.
8. Enforce ESLint boundary is still intact; add a CI check that fails if `editor-core/` contains a React import.
9. PR.

## Validation

| Check | How |
| --- | --- |
| No legacy references | Greps above return zero |
| `features/editor/engine/` gone | `ls frontend/src/features/editor/engine` → not found |
| Docs updated | `CLAUDE.md` editor section reflects new architecture |
| Perf targets hit | See README perf target table; all must be green |
| Exports still work | Full export smoke on 3 different projects |

## Exit Criteria

- Migration is complete.
- All perf targets met.
- Documentation reflects reality.
- CI has a boundary check on `editor-core/`.

## Rollback

At this point rollback would mean reverting the whole migration, which is not realistic. Keep the PRs available in git history for reference; partial rollback is per-phase and was possible at the end of each earlier phase.

## Estimate

1 day.

## Final Perf Gate

| Metric | Target | Stretch |
| --- | --- | --- |
| Preview FPS (3-clip 1080p) | ≥ 58 | 60 |
| Preview FPS (10-clip 1080p, captions) | ≥ 45 | 55 |
| Main-thread ms/frame | ≤ 12 | ≤ 8 |
| Scrub latency p95 | ≤ 80 ms | ≤ 50 ms |
| Memory after 1h playback | ≤ 500 MB | ≤ 350 MB |
| Export time / 30s project (1080p30) | ≤ 2× realtime | ≤ 1.3× |
| Preview ↔ export pixel ΔE (p95) | ≤ 2 | ≤ 1 |
| React commits / 10s playback | ≤ 20 | ≤ 10 |

Any metric that fails = open a follow-up issue, do not mark migration complete.

## Post-Migration Watchlist

Things to monitor in the weeks after:

- New features land in `editor-core/`, not in `features/editor/` — enforce via code review.
- Any new React dep added to `editor-core/` is caught by the ESLint rule.
- Caption pipeline stays pure — any future animation style must not introduce React.
- Export parity maintained — treat pixel diff as a regression test in CI.
