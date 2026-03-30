# Background: Why the Caption Engine Must Die

This document records the root-cause analysis of the current caption system. The purpose is not to catalog bugs — it is to explain why every incremental fix has made things worse and why a clean cut is the only valid move.

---

## Nuclear Reset. Nothing Is Preserved.

The database is being wiped (`bun run db:reset`). Docker containers are being torn down. Every saved composition, every caption record, every exported file — gone. We are starting from a clean schema on a clean database.

This means there is no backwards compatibility problem to solve. There is no old data to read. There are no legacy compositions to handle. The question "what do we do with old caption clips?" has one answer: **it doesn't matter, they don't exist.**

Concretely, this rules out entire categories of work:

- **No `LEGACY_ID_MAP`.** Old preset IDs do not exist in the new codebase. Not even as comments.
- **No migration functions.** There is no data to migrate. `migrateLegacyCaptionClip()` is never written.
- **No adapter layers.** No wrapper that makes the old interface look like the new one. The old interface is deleted.
- **No `@deprecated` annotations.** Nothing is deprecated — it is deleted.
- **No "V2" naming.** There is no `useCaptionsV2` or `CaptionPresetNew`. The new thing has the canonical name.
- **No "keep the old file for reference."** Old files are deleted from the repo, not renamed or archived.

The database is empty. The codebase does not compile mid-rewrite. Both are correct. Work through them.

---

## The Current System at a Glance

The caption engine spans:

| File | Role |
|------|------|
| `frontend/src/features/editor/constants/caption-presets.ts` | 5 preset definitions (`CaptionPreset` flat struct) |
| `frontend/src/features/editor/hooks/useCaptionPreview.ts` | Canvas2D renderer (`drawCaptionsOnCanvas`) |
| `frontend/src/features/editor/hooks/useCaptions.ts` | Whisper transcription mutation + asset query |
| `frontend/src/features/editor/components/Inspector.tsx` | Caption generation UX, adds clips |
| `frontend/src/features/editor/components/PreviewArea.tsx` | Canvas overlay, calls renderer per rAF |
| `frontend/src/features/editor/types/editor.ts` | `CaptionWord`, 6 `caption*` fields on `Clip` |
| `backend/src/routes/editor/captions.ts` | Thin route — delegates to `captions.service.ts` |
| `backend/src/domain/editor/captions.service.ts` | Whisper transcription, idempotency, saves to DB |
| `backend/src/domain/editor/captions.repository.ts` | DB queries for the `caption` table |
| `backend/src/domain/editor/export/ass-generator.ts` | ASS subtitle generation for FFmpeg |
| `backend/src/routes/editor/export-worker.ts` | Thin wrapper — delegates to `run-export-job.ts` |
| `backend/src/domain/editor/run-export-job.ts` | Caption clip detection + ASS injection into FFmpeg pipeline |
| `backend/src/infrastructure/database/drizzle/schema.ts` | `caption` table (words as JSONB) |
| `frontend/src/features/editor/model/editor-reducer-clip-ops.ts` | `ADD_CAPTION_CLIP` action handler |

This is not a lot of code. But it is fundamentally broken in design, not in volume.

---

## Root Cause 1: Caption Data Is Contaminating the Clip Type

The `Clip` type — the fundamental unit of the timeline — carries six caption-specific fields:

```typescript
captionId?: string;
captionWords?: CaptionWord[];
captionPresetId?: string;
captionGroupSize?: number;
captionPositionY?: number;
captionFontSizeOverride?: number;
```

This is wrong. A `Clip` represents a timeline position: when it starts, how long it lasts, which asset it references, basic visual properties. It is not a caption renderer configuration.

The consequence: every component that touches a `Clip` must know about captions. The editor reducer's clip-ops file handles `ADD_CAPTION_CLIP` as a special case. The export worker has a caption detection loop (`textClips.filter(c => c.captionWords)`). The type system cannot distinguish a caption clip from a text clip — they are the same type with optional fields that happen to be populated.

**Fix:** A `CaptionClip` is its own first-class entity. It references a `CaptionDoc` (the transcription) and a `TextPreset` (the style). The `Clip` base type knows nothing about captions.

---

## Root Cause 2: The "Animation System" Is Three Hardcoded Branches

The current animation model:

```typescript
animation: "none" | "highlight" | "karaoke";
```

This is not an animation system. It is three `if/else` branches in `drawWordByWord()`. Adding a fourth animation type — say, a bounce scale on word activation, or a slide-up entry — requires:

1. Adding a new enum value
2. Adding a new branch in the Canvas2D renderer
3. Adding a new branch in the ASS generator
4. Keeping both in sync forever

The system makes every new animation a surgery event. The result: five presets, three animations, zero extensibility.

**Fix:** Animations are declarative `AnimationDef` objects with a property, keyframes, duration, and an easing function. Entry, exit, and per-word activation animations are first-class preset fields. The renderer evaluates them — it does not switch on animation names.

---

## Root Cause 3: The Preset Definition Lives in Two Places

The frontend has `CaptionPreset` (flat struct). The backend has `ASSPresetConfig` (different struct, same data). Both have their own `LEGACY_ID_MAP`. They are manually kept in sync.

As of this writing, the ASS generator duplicates all five presets as a separate `PRESET_TO_ASS` map. The `cssToASS()` color converter in the backend does not have a frontend equivalent — they are parallel implementations of the same transformation.

Every time a preset changes, two files must change. Every time a preset is renamed, two `LEGACY_ID_MAP` entries must be added. This has already drifted once (the 2026-03 overhaul that introduced `"clean-minimal"` and `"dark-box"` from the old `"clean-white"` and `"box-dark"` names).

**Fix:** There is one canonical preset definition. The ASS generator derives from it. It does not maintain its own copy.

---

## Root Cause 4: Single-Line Only, No Word Wrap

`drawCaptionsOnCanvas` renders a single horizontal line of text. It computes `totalWidth` as the sum of word widths + spaces and centers everything. There is no word wrap. Groups of 4–5 long words at 56px font overflow the canvas on vertical (9:16) video — silently. The text just clips.

This is a fundamental rendering limitation that cannot be patched without rewriting the renderer. Any fix requires understanding line breaking, measuring available width, stacking lines, and adjusting the background box height. The current architecture has no concept of "lines within a group."

**Fix:** The renderer operates on `CaptionPage` objects (pre-computed groups of words). The page builder handles word wrapping and produces `CaptionLine[]` within each page. The renderer iterates lines, not a flat word list.

---

## Root Cause 5: No Entry/Exit Animations — Captions Snap

Captions appear and disappear on cut boundaries. There is no fade-in, slide-up, or scale-in on entry. There is no fade-out on exit. For a product that competes with CapCut and OpusClip on the quality of its text animations, this is a severe gap.

This is not a missing feature — it is a structural gap. Adding entry/exit animations to the current system would require threading `clipStartMs` and `clipEndMs` into the renderer, computing a `t` value for entry/exit progress, and applying transformations to the canvas context. The current renderer signature is `(ctx, clip, currentTimeMs, canvasW, canvasH)` — there is no way to apply canvas transforms per-group without restructuring everything.

**Fix:** The renderer accepts a `phase` value (`entry | active | exit`) and an `animationProgress` float [0,1]. All entry/exit animation is defined declaratively in the preset.

---

## Root Cause 6: Font Loading Is Not Managed

The renderer does:

```typescript
ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;
```

This assumes the font is already loaded. If the canvas renders before `Inter` (or any other font) is available, it falls back to the system default — silently, with no error, at the wrong weight and metrics. Text measurement (`ctx.measureText`) is wrong on the wrong font, causing misaligned per-word positioning.

There is no `FontFace.load()` call. There is no `document.fonts.ready` check before the first render. There is no fallback font defined in the preset.

**Fix:** The new system has a `FontLoader` that registers and awaits `FontFace` objects before the canvas renders. Presets declare their font (with optional Google Fonts URL). The renderer will not paint until `fontReady` is true.

---

## Root Cause 7: `groupSize`, `positionY`, and `fontSizeOverride` Are Per-Clip Data

These fields exist on `Clip` as per-clip overrides of preset defaults:

```typescript
captionGroupSize?: number;      // override preset.groupSize
captionPositionY?: number;      // override preset.positionY
captionFontSizeOverride?: number; // override preset.fontSize
```

This is an ad-hoc override system. It is not composable. It cannot be extended without adding more fields to `Clip`. The inspector panel has sliders for these three values and nothing else — because there is no principled way to add a fourth override.

**Fix:** Per-clip style overrides live in a single `styleOverrides: Partial<CaptionStyleConfig>` field on `CaptionClip`. The full override surface is defined by the type — not by adding more fields.

---

## Root Cause 8: Preview and Export Render Differently

The frontend previews captions using Canvas2D (`useCaptionPreview.ts`). The backend exports captions using ASS+FFmpeg (`ass-generator.ts`). These are fundamentally different rendering systems.

Canvas2D supports:
- Arbitrary color values (hex, rgba, hsla)
- `roundRect` for background boxes
- Sub-pixel positioning
- Any canvas transform

ASS supports:
- `&HAABBGGRR` color format
- `BorderStyle: 3` for opaque boxes (not rounded)
- Integer pixel positioning
- `\k` and `\kf` karaoke tags (but not arbitrary color transitions)

The "Dark Box" preset uses `border-radius: 8px` in preview. ASS cannot render rounded corners. The export looks different from the preview. The user sees one thing in the editor and gets a different thing exported.

This is a fundamental contract violation. Preview must match export.

**Fix:** The export layer is a first-class concern in the new architecture. Presets define a separate `exportHint` that describes how to represent effects that ASS cannot render natively (e.g., `rounded: false` in ASS mode).

---

## Root Cause 9: Manual Caption Entry Is Impossible

The system assumes captions come exclusively from Whisper. The `captionId` field on a `Clip` must reference a row in the `caption` table, which can only be created by `POST /api/captions/transcribe`. There is no way to manually type caption words and attach them to a clip.

**Fix:** The `CaptionDoc` has a `source` field: `"whisper" | "manual" | "import"`. Manual captions can be created without an audio asset. The transcription route creates a `CaptionDoc` — but so can a `POST /api/captions/manual` endpoint that accepts raw word-timing data.

---

## What Stays

Not everything is broken:

- The **Whisper transcription route** (`POST /api/captions/transcribe`) is correct. The Whisper integration, idempotency check, R2 download, and DB insert logic are fine. The API surface changes (to return a `captionDocId`), but the core logic is reused.
- The **`CaptionWord` shape** (`{ word, startMs, endMs }`) is correct and stays.
- The **`caption` DB table structure** is largely correct. It gets renamed to `caption_doc` and gains a `source` column.
- The **ASS format choice** for FFmpeg export is correct. ASS is the right format for burn-in subtitles with animation.

Everything else is deleted and rebuilt.

---

## Why "Fix the Current System" Won't Work

The current system's problems are not implementation bugs — they are design mistakes:

- Caption data on `Clip` cannot be removed without changing every component that touches clips.
- The 3-value animation enum cannot be extended without adding branches everywhere.
- The frontend/backend preset duplication cannot be resolved without a shared source of truth (which doesn't exist in this monorepo's "no shared code" architecture).
- The single-line renderer cannot support multi-line without a complete rewrite.
- Entry/exit animations cannot be added without changing the renderer's signature and call sites.

Each of these is load-bearing. Fixing one creates more inconsistency with the others. The only clean path is deletion.
