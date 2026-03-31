# Implementation Plan: Caption Engine v2

This is the execution guide. Follow this order exactly. Skipping phases or building out of order will create a broken intermediate state that is harder to reason about than the current broken system.

---

## Phase 0: Read Before Deleting

Before touching any file, you must have read and understood:

- [ ] `frontend/src/features/editor/types/editor.ts` — full `Clip` type
- [ ] `frontend/src/features/editor/constants/caption-presets.ts`
- [ ] `frontend/src/features/editor/hooks/useCaptionPreview.ts`
- [ ] `frontend/src/features/editor/hooks/useCaptions.ts`
- [ ] `frontend/src/features/editor/components/Inspector.tsx`
- [ ] `frontend/src/features/editor/components/PreviewArea.tsx`
- [ ] `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`
- [ ] `backend/src/routes/editor/captions.ts`
- [ ] `backend/src/domain/editor/export/ass-generator.ts`
- [ ] `backend/src/domain/editor/captions.service.ts`
- [ ] `backend/src/domain/editor/captions.repository.ts`
- [ ] `backend/src/domain/editor/run-export-job.ts` (caption detection + ASS injection lives here, not export-worker)
- [ ] `backend/src/routes/editor/export-worker.ts` (thin pass-through to run-export-job)
- [ ] `backend/src/infrastructure/database/drizzle/schema.ts` (caption table)

---

## Blast Radius: Complete Deletion Checklist

Legacy `TitleClip` compatibility is out of scope. If existing title overlays conflict with the new model, delete them and rebuild the title/text system cleanly. Do not add migration code, adapter fields, or fallback rendering paths for old `TitleClip` shapes.

### Files to Delete Entirely

| File | Replacement |
|------|-------------|
| `frontend/src/features/editor/constants/caption-presets.ts` | `frontend/src/features/editor/caption/presets.ts` |
| `frontend/src/features/editor/hooks/useCaptionPreview.ts` | `frontend/src/features/editor/caption/renderer.ts` |
| `frontend/src/features/editor/hooks/useCaptions.ts` | `frontend/src/features/editor/caption/hooks/useTranscription.ts` + `useCaptionDoc.ts` |
| `frontend/src/features/editor/components/CaptionPresetTile.tsx` | Part of new `CaptionPresetPicker.tsx` |
| `backend/src/domain/editor/export/ass-generator.ts` | `backend/src/domain/editor/export/ass-exporter.ts` (same folder, full rewrite) |

### Files to Heavily Modify (Not Delete)

| File | Changes |
|------|---------|
| `frontend/src/features/editor/types/editor.ts` | Remove 6 `caption*` fields from `Clip`. Add `CaptionClip` type. Add `UPDATE_CAPTION_STYLE` action. Change `ADD_CAPTION_CLIP` payload. |
| `frontend/src/features/editor/model/editor-reducer-clip-ops.ts` | Rewrite `ADD_CAPTION_CLIP` handler. Add `UPDATE_CAPTION_STYLE` handler. |
| `frontend/src/features/editor/components/Inspector.tsx` | Remove `useAutoCaption`, `addCaptionClip` old flow. Mount new `CaptionStylePanel`. |
| `frontend/src/features/editor/components/inspector/InspectorClipMetaPanel.tsx` | Remove caption generation button (auto-transcription replaces it). |
| `frontend/src/features/editor/components/inspector/InspectorTextAndCaptionPanels.tsx` | Remove caption style section (replaced by `CaptionStylePanel`). |
| `frontend/src/features/editor/components/PreviewArea.tsx` | Replace `useCaptionPreview`/`drawCaptionsOnCanvas` call with `useCaptionCanvas` hook. |
| `frontend/src/shared/lib/query-keys.ts` | Replace legacy caption keys with `queryKeys.api.captionDoc()` and `queryKeys.api.captionDocByAsset()`. |
| `frontend/src/translations/en.json` | Remove old keys, add new keys (see LLD). |
| `backend/src/routes/editor/captions.ts` | Change response field `captionId` → `captionDocId`. Add exact doc read/update routes and `POST /manual`. |
| `backend/src/domain/editor/run-export-job.ts` | Update caption clip detection (`clip.type === "caption"`). Load `CaptionDoc` from DB by `captionDocId`. Call new `generateASS` from `ass-exporter.ts`. |
| `backend/src/routes/editor/export-worker.ts` | No caption logic here — it's a thin pass-through. No changes needed beyond ensuring it still delegates correctly. |
| `backend/src/domain/editor/captions.service.ts` | Update `transcribeAsset()` to return `captionDocId`. Add `createManual()`. Update DB calls to use renamed table. |
| `backend/src/domain/editor/captions.repository.ts` | Update all queries to use `captionDocs` (renamed table). Add `source` column handling. |
| `backend/src/routes/editor/editor-ai.router.ts` | Update `ADD_CAPTION_CLIP` construction to new shape. |
| `backend/src/routes/editor/services/build-initial-timeline.ts` | Update `buildCaptionClip()` to produce new `CaptionClip` shape. |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Rename `captions` → `captionDocs`. Add `source` column. Make `assetId` nullable. |
| `backend/src/types/timeline.types.ts` | Remove `CaptionWord` and 6 `caption*` fields from backend `Clip`. Add `CaptionClip` type. |
| `backend/src/types/index.ts` | Update re-exports. |
| `frontend/src/features/editor/caption/hooks/useCaptionDoc.ts` | Fetch by `captionDocId`, not `assetId`. |
| `frontend/src/features/editor/caption/components/CaptionTranscriptEditor.tsx` | New transcript correction UI. |
| `frontend/src/features/editor/caption/components/CaptionLanguageScopeNotice.tsx` | Explicit "English only" scope notice in caption UI. |

### Tests to Delete

| Test File | Reason |
|-----------|--------|
| `backend/__tests__/unit/routes/editor/build-initial-timeline-caption-compose.test.ts` | Tests old `composeOverlayText` which no longer exists |
| `backend/__tests__/unit/routes/video-timeline-validation.test.ts` (caption-specific cases) | `CAPTION_INVALID_TIME_RANGE` etc. validation changes |
| `backend/__tests__/unit/routes/video-route-utils.test.ts` (`extractCaptionSourceText` test) | Only if this function is removed |

### New Tests to Write

| File | Tests |
|------|-------|
| `frontend/__tests__/unit/features/editor/caption/page-builder.test.ts` | `buildPages()` grouping, gap detection, edge cases (empty, single word, gap > threshold) |
| `frontend/__tests__/unit/features/editor/caption/easing.test.ts` | `evaluate()` for each easing type, spring boundary conditions |
| `frontend/__tests__/unit/features/editor/caption/layout-engine.test.ts` | `computeLayout()` word wrap, single line, overflow, positionY calc |
| `frontend/__tests__/unit/features/editor/caption/slice-tokens.test.ts` | clip source-window slicing, re-basing timestamps, empty-range behavior |
| `backend/__tests__/unit/domain/captions/page-builder.test.ts` | Same tests as frontend (identical function) |
| `backend/__tests__/unit/domain/captions/ass-exporter.test.ts` | `generateASS()` for each export mode, legacy ID resolution, `cssToASS()` |
| `backend/__tests__/unit/routes/editor/captions.test.ts` | `POST /manual` validation, `PATCH /doc/:captionDocId`, `captionDocId` response field |
| `frontend/__tests__/unit/features/editor/caption/transcript-editor.test.tsx` | correction save flow, validation errors, split/merge actions |
| `backend/__tests__/unit/routes/editor/captions-language.test.ts` | reject non-English `language` values on manual create/update |

---

## Build Order

### Phase 1: DB Migration (Backend)

1. Write migration: rename `caption` → `caption_doc`, add `source` column, make `assetId` nullable, add `updatedAt`.
2. Constrain `language` to `"en"` for v2 at validation/type level.
3. Update Drizzle schema: rename `captions` export → `captionDocs`, update type.
4. Update all DB queries that reference `captions` table.
5. Keep request validation schemas in `backend/src/domain/editor/editor.schemas.ts` and re-export through `backend/src/routes/editor/schemas.ts`.
6. Run `bun run db:generate && bun run db:migrate`.
7. Update `backend/src/types/index.ts` exports.

**At this point:** Backend compiles. Old routes still work (the table is renamed, column names unchanged except `source` addition).

---

### Phase 2: Backend Type System

1. In `backend/src/types/timeline.types.ts`:
   - Remove `CaptionWord` (it's now `Word` and lives in schema types).
   - Remove 6 `caption*` fields from `Clip`.
   - Add `CaptionClip` interface in-place (do not move timeline clip ownership out of this file family).
   - Add `sourceStartMs`, `sourceEndMs`, and optional `originVoiceoverClipId`.
   - Export `Word` from schema types.

2. In `backend/src/types/index.ts`: update exports.

**At this point:** Backend will have type errors in `export-worker.ts`, `editor-ai.router.ts`, `build-initial-timeline.ts`. That's expected — proceed.

---

### Phase 3: Backend Domain Layer (New Files)

Create `backend/src/domain/editor/captions/` (consistent with existing `domain/editor/` structure):

1. `page-builder.ts` — implement `buildPages()`.
2. `slice-tokens.ts` — implement source-window slicing and timestamp re-basing.
3. `preset-registry.ts` — mirror of frontend presets (same 10 presets, same IDs, TypeScript objects). This file is verbose but necessary (no shared code rule).

In `backend/src/domain/editor/export/`:

4. Delete `ass-generator.ts`. Write `ass-exporter.ts` — implement `generateASS(pages, preset, resolution, clipStartMs)`. Derives style from `TextPreset` objects in `preset-registry.ts`. Includes `cssToASS()` and `msToASSTime()` utilities.

Write tests for Phase 3 now (`page-builder.test.ts`, `slice-tokens.test.ts`, `ass-exporter.test.ts`).

---

### Phase 4: Backend Routes Update

1. `backend/src/routes/editor/captions.ts`:
   - Rename `captionId` → `captionDocId` in all responses.
   - Add `POST /manual` route.
   - Add `GET /doc/:captionDocId` route for exact doc reads.
   - Add `PATCH /doc/:captionDocId` route for transcript correction.
   - Update DB table reference from `captions` → `captionDocs`.
   - Reject non-`"en"` language values.
   - Keep this router mounted as standalone `/api/captions` in `backend/src/index.ts` to match existing routing.

2. `backend/src/domain/editor/run-export-job.ts` (not export-worker — that's a thin wrapper):
   - Delete `generateASS` import from old `ass-generator` path.
   - Import from `./export/ass-exporter`.
   - Update caption clip detection: `clip.type === "caption"` instead of `clip.captionWords?.length`.
   - Load `CaptionDoc` from DB using `captionDocId` on the clip.
   - Slice `doc.words` by `clip.sourceStartMs/sourceEndMs`.
   - Call `buildPages(tokens, clip.groupingMs)` to get pages.
   - Pass `CaptionPage[]` to `generateASS` instead of raw `words[]`.

3. `backend/src/routes/editor/editor-ai.router.ts`:
   - Update `ADD_CAPTION_CLIP` clip construction to new `CaptionClip` shape.
   - Remove `captionWords: []` field (words come from caption_doc).

4. `backend/src/routes/editor/services/build-initial-timeline.ts`:
   - Update `buildCaptionClip()` to return new `CaptionClip` shape with source window copied from the voiceover clip.

5. **Delete** `backend/src/routes/editor/export/ass-generator.ts`.

**At this point:** Backend compiles cleanly. All tests pass.

---

### Phase 5: Frontend Type System

1. In `frontend/src/features/editor/types/editor.ts`:
   - Remove `CaptionWord` type (it was defined here, now lives in caption/types.ts).
   - Remove 6 `caption*` fields from `Clip`.
   - Keep timeline clip ownership in this file; do not move `Clip`/`CaptionClip` into the caption module.
   - Update `ADD_CAPTION_CLIP` action payload (remove `captionWords`, add `captionDocId`).
   - Add `sourceStartMs` and `sourceEndMs` to `ADD_CAPTION_CLIP`.
   - Add `UPDATE_CAPTION_STYLE` action.

2. In `frontend/src/shared/lib/query-keys.ts`:
   - Replace `captionsByAsset` with `queryKeys.api.captionDocByAsset(assetId)`.
   - Add `queryKeys.api.captionDoc(captionDocId)`.

**At this point:** Frontend has many type errors. That's correct. Do not fix them yet — proceed to Phase 6.

---

### Phase 6: Frontend Caption Module (New Files)

Create `frontend/src/features/editor/caption/`:

1. `types.ts` — caption renderer/layout/preset types only; timeline types stay in `features/editor/types/editor.ts`.
2. `easing.ts` — `evaluate()`, `springValue()`.
3. `page-builder.ts` — `buildPages()`.
4. `slice-tokens.ts` — apply clip source window before grouping.
5. `layout-engine.ts` — `computeLayout()`.
6. `renderer.ts` — `renderFrame()`.
7. `font-loader.ts` — `FontLoader` class.
8. `presets.ts` — 10 presets from `04-presets.md`.
9. `hooks/useTranscription.ts` — mutation hook using `useAuthenticatedFetch()`.
10. `hooks/useCaptionDoc.ts` — query hook by `captionDocId` using `useQueryFetcher()`.
11. `hooks/useUpdateCaptionDoc.ts` — transcript correction mutation using `useAuthenticatedFetch()`.
12. `hooks/useCaptionCanvas.ts` — canvas orchestration hook.
13. `components/CaptionPresetPicker.tsx`.
14. `components/CaptionStylePanel.tsx`.
15. `components/CaptionTranscriptEditor.tsx`.
16. `components/CaptionLanguageScopeNotice.tsx`.

Write tests for Phase 6 (`page-builder.test.ts`, `slice-tokens.test.ts`, `easing.test.ts`, `layout-engine.test.ts`, `transcript-editor.test.tsx`).

**Delete** these files now (their replacements are built):
- `frontend/src/features/editor/constants/caption-presets.ts`
- `frontend/src/features/editor/hooks/useCaptionPreview.ts`
- `frontend/src/features/editor/hooks/useCaptions.ts`
- `frontend/src/features/editor/components/CaptionPresetTile.tsx`

---

### Phase 7: Frontend Reducer Update

In `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`:

1. Remove old `ADD_CAPTION_CLIP` handler.
2. Write new `ADD_CAPTION_CLIP` handler: creates a `CaptionClip` (no embedded words).
   - Carry `originVoiceoverClipId`, `sourceStartMs`, and `sourceEndMs`.
3. Add `UPDATE_CAPTION_STYLE` handler: updates `stylePresetId`, `styleOverrides`, or `groupingMs` on a `CaptionClip`.

In `frontend/src/features/editor/hooks/useEditorStore.ts`:
1. Remove old `addCaptionClip` export.
2. Add new `addCaptionClip` (updated payload).
3. Add `updateCaptionStyle`.

---

### Phase 8: Frontend Component Update

1. `PreviewArea.tsx`:
   - Remove `captionCanvasRef`, `drawCaptionsOnCanvas` call.
   - Mount `useCaptionCanvas` hook.
   - Attach returned canvas ref to the overlay canvas element.

2. `Inspector.tsx`:
   - Remove `useAutoCaption()`.
   - Remove old `addCaptionClip()` call.
   - Add clip-scoped transcription trigger with dedupe: one caption job per voiceover clip. Whether this triggers automatically on voiceover insertion or via a one-step explicit action is a **product decision** — implement with a clear trigger point that can be toggled without architectural changes. Start with automatic triggering and revert to one-step if UX testing shows duplication/surprise issues.
   - Persist `idle | transcribing | ready | failed | stale` state for the selected voiceover clip.
   - Mount `CaptionPresetPicker`, `CaptionStylePanel`, and `CaptionTranscriptEditor` when selected clip is `type: "caption"`.

3. `InspectorClipMetaPanel.tsx`:
   - Remove `AutoCaptionUi` props and the "Generate Text for Clip" button.
   - Replace with a re-transcribe action that updates the linked caption doc/clip rather than creating duplicates.

4. `InspectorTextAndCaptionPanels.tsx`:
   - Remove caption style section entirely.
   - (`CaptionStylePanel` is mounted directly by `Inspector.tsx` now.)

---

### Phase 9: Translation Update

In `frontend/src/translations/en.json`:
1. Remove all `editor_captions_*` keys.
2. Remove `inspector_prop_caption_*` keys.
3. Add new keys from LLD.
4. Ensure caption surfaces explicitly say English-only.

---

### Phase 10: Completeness Verification

Run these checks before declaring done:

1. **grep for old names** — these should return zero results:
   ```bash
   grep -r "captionWords" frontend/src backend/src
   grep -r "captionPresetId" frontend/src backend/src
   grep -r "captionGroupSize" frontend/src backend/src
   grep -r "captionPositionY" frontend/src backend/src
   grep -r "captionFontSizeOverride" frontend/src backend/src
   grep -r "useCaptionPreview" frontend/src
   grep -r "drawCaptionsOnCanvas" frontend/src
   grep -r "CaptionPreset" frontend/src backend/src  # old flat type
   grep -r "ass-generator" backend/src   # should be gone, replaced by ass-exporter
   grep -r "captionsByAsset" frontend/src
   ```

2. **Build both packages:**
   ```bash
   cd frontend && bun run type-check
   cd backend && bun run build
   ```

3. **Run tests:**
   ```bash
   cd frontend && bun test
   cd backend && bun test
   ```

4. **Check for dead imports** — no file should import from a deleted path.

5. **Verify codebase pattern alignment** — caption queries use `queryKeys.api.*`, query hooks use `useQueryFetcher()`, mutation hooks use `useAuthenticatedFetch()`, route schemas live in `domain/editor/editor.schemas.ts`, and `/api/captions` remains mounted from `backend/src/index.ts`.

6. **Verify preview/export identity** — change a caption doc via the editor, refresh, and confirm preview still loads the exact saved `captionDocId`.

7. **Verify trimmed-source behavior** — use a voiceover clip with non-zero trim and confirm preview/export start at the trimmed transcript segment, not token 0.

8. **Verify export pipeline** — run a test export with a voiceover asset and confirm ASS file is generated and video is exported correctly.

9. **Verify auto-transcription dedupe** — selecting the same voiceover repeatedly or re-triggering while in progress must not create duplicate caption clips.

10. **Verify language scope** — non-English `language` values are rejected server-side and the UI clearly labels captions as English-only.

---

## Also: Remove Max Length Cap on Text Clips

While ripping out the caption system, also remove the max length constraint on text clips. The cap makes no sense — a text overlay should be able to span any duration the user wants. Text clips don't "end" the way media clips do (a video clip is bounded by its source file). Capping length is an artificial constraint that fights the user.

Find and delete wherever this cap is enforced — validation schema, reducer guard, or UI slider max — and remove it entirely.

---

## No Migration. The DB Is Wiped.

`bun run db:reset` has been run. Docker containers have been torn down. The database is empty. There is no old data.

This eliminates an entire category of work. Do not write:
- Migration functions
- Legacy ID resolvers
- On-read conversion logic
- Compatibility shims of any kind

The schema is defined fresh from the new Drizzle schema. The first composition written to the DB will be in the new format. That is the only format that exists.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| The `caption` → `caption_doc` table rename breaks existing data | Non-issue. DB is wiped. Schema is created fresh. |
| Legacy compositions with old `captionWords` embedded in clip JSON | Non-issue. DB is wiped. No old compositions exist. |
| Preview loads a different caption doc than export | All rendering paths fetch by `captionDocId`; asset-level lookup is convenience-only. |
| Trimmed/reused voiceovers render the wrong transcript slice | `CaptionClip` stores `sourceStartMs/sourceEndMs`; preview and export both slice/re-base before grouping. |
| Whisper mistakes ship without correction | `CaptionTranscriptEditor` + `PATCH /api/captions/doc/:captionDocId` are required before feature-complete signoff. |
| Auto-transcription creates duplicate caption clips | Caption generation is idempotent per voiceover clip and verified in Phase 10. |
| Users assume multilingual support | UI and API both enforce English-only scope in v2. |
| Implementation drifts from existing project conventions | Verification requires `queryKeys.api.*`, `useQueryFetcher()`, `useAuthenticatedFetch()`, existing schema files, and the standalone `/api/captions` mount. |
| Backend and frontend preset registries drift out of sync | A test in each package compares preset IDs. CI fails if they diverge. |
| `buildPages()` logic diverges between frontend and backend copies | Same test suite run in both packages validates identical output for identical input. |
| Font loading fails in certain browser environments | `FontLoader` catches rejection and falls back to system sans-serif. Caption renders correctly (at wrong font) rather than failing to render. |
| OffscreenCanvas transfer breaks the existing canvas ref pattern | The new `useCaptionCanvas` hook does not use OffscreenCanvas yet — it uses a regular canvas ref. OffscreenCanvas is a future optimization (Phase X). No risk in v2. |
