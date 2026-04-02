# Caption Engine v2 — Implementation Review

**Date:** 2026-04-01
**Reviewed against:** `05-implementation-plan.md`, `02-hld.md`, `03-lld.md`, `04-presets.md`
**Overall status:** ~70% functionally complete, ~90% architecturally sound

---

## Summary

The data model, API contracts, database schema, type system, reducer actions, query keys, and module structure are all correctly implemented and follow both the plan and existing codebase conventions. All legacy caption fields (`captionWords`, `captionPresetId`, `captionGroupSize`, `captionPositionY`, etc.) are fully deleted with no backwards-compatibility shims.

**The blocking gaps are isolated entirely to the Canvas2D rendering pipeline in `renderer.ts` and the animation timing logic in `useCaptionCanvas.ts`.** Nothing renders correctly in preview yet.

---

## What Is Complete

| Area | Files | Status |
|---|---|---|
| Type system | `types/editor.ts` | `CaptionClip`, `CaptionStyleOverrides`, `TimelineClip` union — correct |
| Caption module structure | `caption/` directory | All required files present (`types.ts`, `page-builder.ts`, `slice-tokens.ts`, `layout-engine.ts`, `renderer.ts`, `easing.ts`, `font-loader.ts`, all hooks, all components) |
| Reducer actions | `model/editor-reducer-clip-ops.ts` | `ADD_CAPTION_CLIP`, `UPDATE_CAPTION_STYLE` correctly implemented |
| EditorContext | `context/EditorContext.tsx` | `addCaptionClip`, `updateCaptionStyle` exported |
| Query keys | `shared/lib/query-keys.ts` | `captionDocByAsset`, `captionDoc`, `captionPresets` follow project convention |
| Type guards | `utils/clip-types.ts` | `isCaptionClip`, `isMediaClip`, `isTextContentClip` |
| Inspector integration | `components/Inspector.tsx` | Transcription trigger, stale-clip detection, all caption panels mounted |
| Backend routes | `backend/src/routes/editor/captions.ts` | All 6 endpoints: transcribe, manual, presets, doc GET, doc PATCH, asset lookup |
| Backend service | `backend/src/domain/editor/captions.service.ts` | All methods: transcribe, createManual, getCaptionDoc, updateCaptionDoc, listPresets, getCaptionsForAsset |
| DB schema | `backend/.../schema.ts` | `captionDocs`, `captionPresets` tables with correct indexes |
| Backend caption domain | `backend/src/domain/editor/captions/` | `page-builder.ts`, `slice-tokens.ts`, `types.ts`, `preset-seed.ts` (all 10 presets), `preset.repository.ts` |
| Export layer | `backend/src/domain/editor/export/ass-exporter.ts` | Full ASS generation with color conversion, karaoke mode |
| Export job integration | `backend/src/domain/editor/run-export-job.ts` | Caption clip detection, page building, ASS injection into FFmpeg filter graph |
| Unit tests | `frontend/__tests__/unit/features/editor/caption/` | `page-builder`, `easing`, `layout-engine`, `slice-tokens`, `transcript-editor` |

---

## Required Changes Before 100% Complete

### P0 — Blocking (preview is visually wrong for all presets)

#### 1. Implement multi-layer rendering in `renderer.ts`

**File:** `frontend/src/features/editor/caption/renderer.ts`

Currently `renderFrame()` only draws a text fill. Every preset defines multiple layers (stroke, shadow, background) that are completely ignored. The canvas output is unstyled plain text for all 10 presets.

Rendering must follow a back-to-front order:

1. **BackgroundLayer** — `ctx.fillRect()` with `padding` and `borderRadius`; respect `mode: "word" | "line"` (word = one box per token, line = one box per full line)
2. **ShadowLayer** — apply `ctx.shadowColor`, `ctx.shadowOffsetX`, `ctx.shadowOffsetY`, `ctx.shadowBlur` before the fill pass, then clear after
3. **StrokeLayer** — `ctx.strokeStyle`, `ctx.lineWidth`, `ctx.lineJoin = layer.join`, `ctx.strokeText()`
4. **FillLayer** — `ctx.fillStyle`, `ctx.fillText()` (already done, but currently the only layer)

Each layer resolves its color by checking `stateColors[token.state]` first, then falling back to `color`.

**Affected presets if not fixed:** all 10 (stroke: hormozi, karaoke, bold-outline, pop-scale, glitch; background: dark-box, word-highlight-box; shadow: fade-scale, slide-up)

---

#### 2. Implement entry/exit animation evaluation

**Files:** `frontend/src/features/editor/caption/renderer.ts`, `useCaptionCanvas.ts`

Currently `renderFrame()` only applies a scale pulse (`scalePulse`) on the active word. Page-level entry and exit animations (`scope: "page"`, properties: `opacity`, `scale`, `translateY`) are never evaluated.

Changes needed:

- In `useCaptionCanvas.ts`: compute `entryProgress` and `exitProgress` `[0, 1]` values from the clip's elapsed time relative to `page.startMs` and `page.endMs`, using the preset's `entryDurationMs` / `exitDurationMs` fields.
- Pass `{ entryProgress, exitProgress }` into `renderFrame()`.
- In `renderFrame()`: evaluate each `AnimationDef` in the active preset's `animations` array using the easing functions already in `easing.ts`. Apply the computed transform (opacity, scale, translateY) to the canvas context before rendering tokens.
- For `scope: "word"`: apply the animation per-token with `staggerMs` offset applied to the token's index.

**Affected presets if not fixed:** `pop-scale`, `slide-up`, `fade-scale`, `glitch` (3–4 of 10 presets show no animation)

---

### P1 — High (per-state visual effects broken)

#### 3. Apply `layerOverrides` on active token state

**File:** `frontend/src/features/editor/caption/renderer.ts`

`WordActivationEffect.layerOverrides` is typed in `types.ts` but `renderFrame()` never reads it. When `token.state === "active"`, layer color patches from `layerOverrides` must be merged onto the matching layer before rendering that token.

Specifically, for each layer, check if the preset's `wordActivation.layerOverrides` contains an entry with a matching `layerId`. If so, merge the patch (color, stateColors, etc.) before rendering that layer for the active token only.

**Affected presets if not fixed:** `word-highlight-box` (yellow background box on active word never appears)

---

### P2 — Medium (UX debt / spec compliance)

#### 4. Add export mode warning in `CaptionPresetPicker`

**File:** `frontend/src/features/editor/caption/CaptionPresetPicker.tsx`

Per `02-hld.md` (lines 343–350), the UI must show a notice when the selected preset uses `exportMode: "approximate"` or `exportMode: "static"`:

> "Some visual effects in this caption style are simplified in the exported video."

Add a conditional badge or inline notice on presets whose `exportMode !== "full"`. This sets correct user expectations since canvas preview and ASS export are not pixel-identical.

---

#### 5. Add `ease-in-out` easing type

**File:** `frontend/src/features/editor/caption/easing.ts`

The `EasingFunction` union type and `evaluate()` switch are missing the `ease-in-out` case defined in `03-lld.md` (line 110). No current preset uses it, but the type spec is incomplete.

Add `"ease-in-out"` to the union and implement it in `evaluate()`:
```typescript
case "ease-in-out":
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
```

---

### P3 — Low (test coverage)

#### 6. Add ASS exporter unit tests

**Missing file:** `backend/__tests__/unit/domain/captions/ass-exporter.test.ts`

The plan's test checklist includes ASS exporter tests. Cover:
- `msToASSTime()` conversion for edge cases (0ms, sub-second, >1hr)
- `cssToASS()` hex color conversion including alpha
- `generateASS()` output for a minimal page set (assert style line, dialogue line format)

#### 7. Add renderer unit tests

**Missing file:** `frontend/__tests__/unit/features/editor/caption/renderer.test.ts`

Once P0 is resolved, add tests that mock a `CanvasRenderingContext2D` and assert:
- Correct layer draw order (background before stroke before fill)
- Layer color override applied on active token state
- Correct canvas API calls per layer type

---

## Codebase Pattern Compliance

All passing items below were verified by reading the source:

| Pattern | Status | Notes |
|---|---|---|
| `useAuthenticatedFetch` for all API calls | Pass | All caption mutation/query hooks use it |
| Query keys from `shared/lib/query-keys.ts` | Pass | No inline string keys |
| No cross-feature imports | Pass | Caption module is self-contained within `features/editor/` |
| No legacy/compat code | Pass | Zero results for old field names |
| Backend singleton pattern | Pass | `captionsService` in `singletons.ts` |
| `@hono/zod-validator` for route validation | Pass | All 6 routes use schema validation |
| `c.get("auth")` for user identity in handlers | Pass | No double token verification |
| `bun:test` imports in test files | Pass | All caption tests use `describe`/`test`/`expect` from `"bun:test"` |

---

## Effort Estimate to Close All Gaps

| Work item | Effort |
|---|---|
| Multi-layer rendering (P0.1) | ~1 day |
| Entry/exit animation evaluation (P0.2) | ~1 day |
| Layer override patch on active token (P1) | ~0.5 day |
| Export mode warning UI (P2) | ~0.5 day |
| `ease-in-out` easing (P2) | ~15 min |
| ASS exporter + renderer tests (P3) | ~0.5 day |
| **Total** | **~3.5 days** |
