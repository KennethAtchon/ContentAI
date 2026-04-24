# Phase 1 — Cleanse

> Remove all dead / duplicate / legacy code from the editor feature folder.
> After this phase: editor behavior is unchanged, but the codebase is ~N lines smaller and consistent.

## Goal

Make the editor folder structurally honest before scaffolding. Delete:
- Rust/WASM consumer path (keep JS `buildCompositorClips`)
- Duplicate `jsClips` parity check in `PreviewEngine.tickCompositor`
- Empty stub directories left from earlier refactors
- The second context folder (`contexts/` merged into `context/`)
- Any `@deprecated`, `.old.ts`, commented-out-code, unused exports

## Preconditions

- Clean working tree or isolated branch `migration/phase-01-cleanse`
- Recent commit on `main`: `0767ef3 feat: Add comprehensive architecture documentation…`
- `bun run type-check` passes on baseline

## Files Touched (authoritative list)

### Delete
- `frontend/src/features/editor/engine/editor-core-wasm.ts` — WASM bootstrap
- `frontend/src/features/editor/wasm/` — entire dir (`editor_core.js`, `editor_core.d.ts`, `editor_core_bg.wasm`, `editor_core_bg.wasm.d.ts`, `package.json`)
- `frontend/src/features/editor/renderers/` — empty
- `frontend/src/features/editor/scene/` — empty
- `frontend/src/features/editor/preview-root/` — empty

### Modify
- `frontend/src/features/editor/engine/PreviewEngine.ts`
  - Remove imports from `./editor-core-wasm` (lines 7–10)
  - Remove the JS parity check in `tickCompositor` (lines 627–681): drop `rustClips`, drop `jsClips` build-twice logic, call `buildCompositorClips(this.tracks, playheadMs, this.effectPreview)` once, assign to `clips`
  - Remove `preloadEditorCoreWasm` calls and the helper itself
- `frontend/src/features/editor/services/client-export.ts`
  - Remove `import { buildCompositorDescriptorsWithRust }` (line 9)
  - Replace the single usage at line ~462 with `buildCompositorClips(...)` (imported from `../engine/PreviewEngine`)
- `frontend/src/features/editor/contexts/asset-url-map-context.ts` → move to `frontend/src/features/editor/context/AssetUrlMapContext.ts`
  - Update all imports (grep for `contexts/asset-url-map-context`)
  - Delete the now-empty `contexts/` folder

### Search & Destroy (grep first, decide per hit)
- `grep -rn "TODO.*legacy\|DEPRECATED\|@deprecated" frontend/src/features/editor`
- `grep -rn "\.old\|\.legacy" frontend/src/features/editor`
- `grep -rn "// REMOVED\|// old " frontend/src/features/editor`
- `grep -rn "wasm\|editor_core\|preloadEditorCoreWasm" frontend/src` — verify zero matches after modify step

## Step-by-Step

1. **Branch**: `git checkout -b migration/phase-01-cleanse` *(user runs; I never run git)*.
2. **Verify JS descriptor builder is sufficient**
   - Open `PreviewEngine.ts:229-301` (`buildCompositorClips` function).
   - Confirm it produces the same `CompositorClipDescriptor[]` shape the Rust builder returned.
   - If there's any divergence (sort order, field names), fix `buildCompositorClips` FIRST in a micro-commit before deleting the Rust path. We've seen `rustRawClipIds` vs `jsRawClipIds` diffing in prod — don't ship a regression.
3. **Swap in `PreviewEngine.ts`**
   - Replace the dual-build block at 627–681 with a single call:
     ```ts
     const clips = buildCompositorClips(this.tracks, playheadMs, this.effectPreview);
     ```
   - Remove `rustClips`, `jsClips`, all parity variables (`rustClipIds`, `jsClipIds`, `mismatchedClipIds`, `blankRustClipIds`, related `logInfo` calls).
   - Remove the `preloadEditorCoreWasm` call wherever it is (grep for it — likely in the `create()` static).
   - Remove the top-of-file import from `./editor-core-wasm`.
4. **Swap in `client-export.ts`**
   - Replace the WASM descriptor call (~line 462) with `buildCompositorClips`.
   - Remove the WASM import.
5. **Delete files**
   - `rm frontend/src/features/editor/engine/editor-core-wasm.ts` *(user runs)*.
   - `rm -r frontend/src/features/editor/wasm` *(user runs)*.
   - `rm -r frontend/src/features/editor/renderers frontend/src/features/editor/scene frontend/src/features/editor/preview-root` *(user runs)*.
6. **Consolidate context dir**
   - Move `contexts/asset-url-map-context.ts` → `context/AssetUrlMapContext.ts`.
   - Convert file naming to match neighbors (`PascalCase.tsx`/`PascalCase.ts`).
   - Update imports everywhere. `grep -rn 'contexts/asset-url-map' frontend/src` must return zero.
   - `rmdir frontend/src/features/editor/contexts` *(user runs)*.
7. **Sweep stale comments / code**
   - Run the three greps under "Search & Destroy". For each hit: delete or keep with justification in the PR description (not in the code).
8. **Type-check + lint + tests + smoke**
   - `cd frontend && bun run type-check`
   - `cd frontend && bun run lint`
   - `cd frontend && bun test`
   - `cd frontend && bun run dev` → open editor → play a clip → scrub → save → export. No regressions.
9. **Commit** one commit. Suggested message:
   ```
   chore(editor): remove rust/wasm, dead dirs, dup context folder

   - deleted frontend/src/features/editor/wasm/
   - deleted engine/editor-core-wasm.ts
   - removed jsClips parity check in PreviewEngine.tickCompositor (kept js, dropped rust)
   - removed renderers/ scene/ preview-root/ (empty stubs)
   - merged contexts/asset-url-map-context.ts → context/AssetUrlMapContext.ts
   ```
10. **PR** → review → merge.

## Validation

| Check | Command | Expected |
| --- | --- | --- |
| Types | `cd frontend && bun run type-check` | Exit 0 |
| Lint | `cd frontend && bun run lint` | Exit 0 |
| Tests | `cd frontend && bun test` | All pass |
| No WASM imports | `grep -rn "editor_core\|wasm" frontend/src` | No hits inside `features/editor` |
| Preview smoke | manual | Play, scrub, export all work |
| FPS smoke | DevTools Perf record | Expect ~small uptick (5–10 → 8–15) from removing double build; real fix is later phases |

## Exit Criteria

- All four `Delete` paths gone.
- `grep -rn "contexts/" frontend/src/features/editor` returns nothing.
- `PreviewEngine.tickCompositor` builds descriptors once.
- Editor opens, plays, edits, saves, exports.
- PR green, merged.

## Rollback

Single-commit phase → `git revert <sha>` restores the WASM build-once. CI will rebuild the `.wasm` artifact from `frontend/src/features/editor/wasm/` since it's just a checked-in binary in your repo (no cargo step in CI per `package.json`). Low risk.

## Estimate

0.5 day. Trivial changes, mostly deletions. Main risk: hidden consumer of WASM somewhere grep missed. Mitigate by running a full `bun run build` after step 6.

## Out of Scope (deferred to later phases)

- Moving engine to `editor-core/` (phase 2)
- Removing `REACT_PUBLISH_INTERVAL_MS = 250` (phase 3)
- Touching captions (phase 6)
- Unifying export (phase 7)
