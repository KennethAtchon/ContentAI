# Low-Level Design: Caption Engine v2

Complete type definitions, function signatures, API contracts, DB schema, and component specifications.

---

## TypeScript Type System

Codebase-aligned ownership:
- Timeline clip/project/action types stay in `frontend/src/features/editor/types/editor.ts`
- Backend timeline JSON types stay in `backend/src/types/timeline.types.ts`
- Caption renderer/layout/preset-only types live in `frontend/src/features/editor/caption/types.ts`
- Route validation schemas stay in `backend/src/domain/editor/editor.schemas.ts`

### Core Data Types

```typescript
// ─── Transcription Data ──────────────────────────────────────────────────────

/**
 * A single timestamped display token from Whisper (or manual entry).
 * Kept as `Word` in v2 for compatibility with existing terminology, but
 * consumers must treat it as a render token rather than a linguistic word.
 *
 * This type is named `Word` because v2 is English-only and space-delimited
 * tokenization is sufficient. It is NOT a linguistic primitive.
 * If multilingual support is added, rename to `Token` and replace any
 * grouping logic that assumes space-delimited words. Do not add behavior
 * to this type that only makes sense for English.
 */
export interface Word {
  word: string;
  startMs: number;
  endMs: number;
}

/** A CaptionDoc is a transcription attached to an asset. Persisted in DB. */
export interface CaptionDoc {
  id: string;
  assetId: string;
  words: Word[];
  fullText: string;
  language: "en";
  source: "whisper" | "manual" | "import";
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── Grouping Layer ───────────────────────────────────────────────────────────

/** A word with its position within a page. */
export interface WordToken {
  word: string;
  startMs: number;
  endMs: number;
  /** Index within the page's token list. */
  index: number;
  /** State at a given playback time. Computed by the renderer. */
  state: "upcoming" | "active" | "past";
}

/**
 * A CaptionPage is a group of words that appear together on screen.
 * Built by buildPages() from a CaptionDoc.
 */
export interface CaptionPage {
  /** Absolute start time (relative to the clip's startMs). */
  startMs: number;
  /** Absolute end time (relative to the clip's startMs). */
  endMs: number;
  tokens: Omit<WordToken, "state">[];
  /** Pre-joined display text of all tokens. */
  text: string;
}
```

---

### Style System Types

```typescript
// ─── Style Layers ─────────────────────────────────────────────────────────────

/**
 * Layers are rendered back-to-front. Define all visual properties as layers.
 * Background layers draw before text fill layers.
 */
export type StyleLayer =
  | FillLayer
  | StrokeLayer
  | ShadowLayer
  | BackgroundLayer
  | GlowLayer;

export interface FillLayer {
  type: "fill";
  color: string; // CSS color string
  /**
   * Optional per-state color overrides.
   * If defined, overrides `color` for the given word state.
   */
  stateColors?: {
    upcoming?: string;
    active?: string;
    past?: string;
  };
}

export interface StrokeLayer {
  type: "stroke";
  color: string;
  width: number; // px
  join: "round" | "miter" | "bevel";
}

export interface ShadowLayer {
  type: "shadow";
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number; // px
}

/**
 * Background is applied per-word or per-line.
 * mode: "word" — a box is drawn behind each word individually (moves with active word)
 * mode: "line" — a single box covers all words in a line
 */
export interface BackgroundLayer {
  type: "background";
  color: string;
  padding: number;
  radius: number;
  mode: "word" | "line";
  /**
   * Optional per-state color overrides.
   * Useful for "highlight box on active word" effect.
   */
  stateColors?: {
    upcoming?: string;
    active?: string;
    past?: string;
  };
}

export interface GlowLayer {
  type: "glow";
  color: string;
  blur: number;
}

// ─── Animation System ─────────────────────────────────────────────────────────

export type EasingFunction =
  | { type: "linear" }
  | { type: "ease-in"; power: number }
  | { type: "ease-out"; power: number }
  | { type: "ease-in-out"; power: number }
  | { type: "cubic-bezier"; x1: number; y1: number; x2: number; y2: number }
  | { type: "spring"; stiffness: number; damping: number; mass: number };

export type AnimatableProperty =
  | "opacity"
  | "scale"
  | "translateX"
  | "translateY"
  | "rotation"
  | "letterSpacing";

export type AnimationScope = "page" | "word" | "char";

/**
 * A declarative animation definition.
 *
 * scope: what level the animation applies to
 * property: which CSS-analog property is animated
 * from/to: start and end values (unitless; interpreted by renderer per property)
 * durationMs: how long the animation runs
 * staggerMs: delay between each scope unit (e.g., stagger each word's entry)
 */
export interface AnimationDef {
  scope: AnimationScope;
  property: AnimatableProperty;
  from: number;
  to: number;
  durationMs: number;
  easing: EasingFunction;
  staggerMs?: number;
}

/**
 * Controls the visual state of the active word during playback.
 * Applied while a word's state === "active".
 */
export interface WordActivationEffect {
  /**
   * Layer overrides applied to the active word.
   * These override (not replace) the preset's base layers for active words.
   * Typically used for stateColors on FillLayer/BackgroundLayer.
   */
  layerOverrides?: Partial<StyleLayer>[];
  /**
   * Optional scale pulse on word activation.
   * The word scales from `from` to 1.0 over `durationMs`.
   */
  scalePulse?: {
    from: number;
    durationMs: number;
    easing: EasingFunction;
  };
}

// ─── Typography ──────────────────────────────────────────────────────────────

export interface Typography {
  fontFamily: string;
  /** Numeric weight: 400 | 500 | 600 | 700 | 800 | 900 */
  fontWeight: number;
  /** Base font size at 1080p (9:16). Scaled proportionally for other resolutions. */
  fontSize: number;
  textTransform: "none" | "uppercase" | "lowercase";
  letterSpacing: number; // em units
  lineHeight: number;    // multiplier, e.g., 1.2
  /** Optional Google Fonts URL for FontLoader. */
  fontUrl?: string;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export interface PresetLayout {
  alignment: "left" | "center" | "right";
  /** Max width as % of canvas width (e.g., 80 = 80%). */
  maxWidthPercent: number;
  /** Vertical position as % from top (e.g., 80 = 80% from top). */
  positionY: number;
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * How this preset is handled during ASS export.
 * "full"        — ASS can represent this style exactly.
 * "approximate" — ASS approximates with karaoke/color tags.
 * "static"      — Export produces static text (no animation).
 */
export type ExportMode = "full" | "approximate" | "static";

// ─── TextPreset ──────────────────────────────────────────────────────────────

/**
 * A TextPreset is the complete visual definition for a caption style.
 * All style, animation, and export behavior is declared here.
 * Presets are immutable — per-clip tweaks go in CaptionClip.styleOverrides.
 *
 * Although defined here for the caption engine, the visual parts of a preset
 * (typography, layers, layout) may also be reused by other text clip types
 * such as TitleClip. Caption-only fields like groupingMs, wordActivation, and
 * timed export behavior are only consumed by CaptionClip.
 */
export interface TextPreset {
  id: string;
  name: string;

  typography: Typography;

  /**
   * Visual layers, rendered in order (first = bottom, last = top).
   * For text: background layers should come before fill/stroke layers.
   */
  layers: StyleLayer[];

  layout: PresetLayout;

  /**
   * Entry animation: applied when the page first appears.
   * null = instant appearance.
   */
  entryAnimation: AnimationDef[] | null;

  /**
   * Exit animation: applied before the page disappears.
   * null = instant disappearance.
   */
  exitAnimation: AnimationDef[] | null;

  /**
   * Per-word activation effect: applied while state === "active".
   * null = no activation effect (all words render identically).
   */
  wordActivation: WordActivationEffect | null;

  /**
   * Default grouping window in milliseconds.
   * buildPages() groups words that fit within this window into one page.
   * Overridable per-clip via CaptionClip.groupingMs.
   */
  groupingMs: number;

  exportMode: ExportMode;
}

// ─── Style Overrides ─────────────────────────────────────────────────────────

/**
 * Per-clip overrides applied on top of the resolved preset.
 * All fields optional — only specified fields are overridden.
 */
export interface CaptionStyleOverrides {
  positionY?: number;
  fontSize?: number;
  textTransform?: Typography["textTransform"];
}

// ─── Timeline Clip Type ───────────────────────────────────────────────────────

/**
 * A CaptionClip is a first-class timeline clip type.
 * It references a CaptionDoc and a TextPreset.
 * It does NOT embed word data — that lives in CaptionDoc (DB).
 *
 * This belongs in the existing editor timeline type files:
 * - frontend/src/features/editor/types/editor.ts
 * - backend/src/types/timeline.types.ts
 */
export interface CaptionClip {
  // Base clip fields (shared with all timeline clips)
  id: string;
  type: "caption";           // discriminator — new, replaces loose caption* fields on Clip
  startMs: number;
  durationMs: number;

  // Caption-specific fields
  originVoiceoverClipId?: string; // when auto-generated from a voiceover clip
  captionDocId: string;      // FK → caption_doc.id
  sourceStartMs: number;     // inclusive range into caption_doc.words
  sourceEndMs: number;       // exclusive range into caption_doc.words
  stylePresetId: string;     // resolved via getPreset(id)
  styleOverrides: CaptionStyleOverrides;
  groupingMs: number;        // overrides preset.groupingMs if > 0
}
```

---

### Rendering Types

```typescript
// frontend/src/features/editor/caption/types.ts (continued)

/**
 * A positioned word within a computed layout.
 * Produced by computeLayout(). Consumed by renderFrame().
 */
export interface PositionedWord {
  word: string;
  startMs: number;
  endMs: number;
  x: number;       // canvas px, center-anchor
  y: number;       // canvas px, baseline
  width: number;   // measured text width
  lineIndex: number;
}

/**
 * Pre-computed layout for a caption page.
 * Stable across frames while the page is active.
 * Recomputed only when the active page changes or the canvas resizes.
 */
export interface CaptionLayout {
  page: CaptionPage;
  preset: TextPreset;
  words: PositionedWord[];
  /** Total height of all lines. Used to position background box. */
  totalHeight: number;
  lineCount: number;
  canvasW: number;
  canvasH: number;
}
```

---

## Function Signatures

### Page Builder

```typescript
// frontend/src/features/editor/caption/page-builder.ts
// backend/src/domain/captions/page-builder.ts  (identical copy)

/**
 * Groups words into display pages.
 *
 * Algorithm:
 *   Start a new page when:
 *   (a) the time gap between the last word's endMs and the next word's startMs
 *       exceeds `gapThresholdMs` (natural pause), OR
 *   (b) the accumulated duration of the current page exceeds `groupingMs`
 *
 * The `groupingMs` window controls how many words appear together.
 * A value of ~1200ms yields ~3 words at normal speaking pace.
 * A value of ~400ms yields word-by-word animation.
 *
 * @param words   - Word-level timestamps from a CaptionDoc.
 * @param groupingMs - Max duration (ms) for one page. Default: 1400.
 * @param gapThresholdMs - Min gap (ms) between words to force a new page. Default: 800.
 */
export function buildPages(
  words: Word[],
  groupingMs?: number,
  gapThresholdMs?: number,
): CaptionPage[];

/**
 * Extract the subset of tokens that belong to a clip's source range and
 * re-base them so the first visible token starts at 0 relative to the clip.
 */
export function sliceTokensToRange(
  words: Word[],
  sourceStartMs: number,
  sourceEndMs: number,
): Word[];
```

### Layout Engine

```typescript
// frontend/src/features/editor/caption/layout-engine.ts

/**
 * Compute the canvas positions of all words in a page.
 *
 * Steps:
 *   1. Measure each word with ctx.measureText() at preset font settings.
 *   2. Wrap words into lines within maxWidthPercent * canvasW.
 *   3. Stack lines vertically with preset.typography.lineHeight spacing.
 *   4. Anchor the block at preset.layout.positionY (% from top),
 *      applying styleOverrides.positionY if present.
 *   5. Return CaptionLayout with all word positions.
 *
 * The returned layout is stable — cache it until the page changes or
 * the canvas dimensions change.
 *
 * @param ctx       - Canvas 2D context (used for text measurement only).
 * @param page      - The current caption page.
 * @param preset    - Resolved TextPreset (with overrides applied).
 * @param canvasW   - Canvas width in pixels.
 * @param canvasH   - Canvas height in pixels.
 */
export function computeLayout(
  ctx: CanvasRenderingContext2D,
  page: CaptionPage,
  preset: TextPreset,
  canvasW: number,
  canvasH: number,
): CaptionLayout;
```

### Renderer

```typescript
// frontend/src/features/editor/caption/renderer.ts

/**
 * Render a single frame of a caption page.
 *
 * Pure function. No state mutations. Call once per animation frame.
 *
 * Steps:
 *   1. Determine word states (upcoming/active/past) based on relativeMs.
 *   2. Evaluate entry/exit animation progress (0..1) based on page timing.
 *   3. Apply canvas transform (translate/scale/opacity) for page animation.
 *   4. For each word in layout:
 *      a. Apply word activation scale pulse if state === "active".
 *      b. Draw layers in order (background, glow, shadow, stroke, fill).
 *      c. Apply stateColors from FillLayer and BackgroundLayer.
 *   5. Restore canvas transform.
 *
 * Does NOT clear the canvas — caller is responsible for clearRect().
 *
 * @param ctx        - Canvas 2D context.
 * @param layout     - Pre-computed CaptionLayout.
 * @param relativeMs - Playback time relative to clip startMs.
 * @param preset     - Resolved TextPreset (with overrides applied).
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: CaptionLayout,
  relativeMs: number,
  preset: TextPreset,
): void;
```

### Easing

```typescript
// frontend/src/features/editor/caption/easing.ts

/**
 * Evaluate an easing function at time t ∈ [0, 1].
 * Returns a value typically in [0, 1] (spring may exceed 1 briefly).
 */
export function evaluate(fn: EasingFunction, t: number): number;

/**
 * Spring simulation using the damped harmonic oscillator.
 * Returns position at time t (seconds, not normalized).
 */
export function springValue(
  t: number,
  stiffness: number,
  damping: number,
  mass: number,
): number;
```

### Preset Resolution

```typescript
// frontend/src/features/editor/caption/presets.ts

export const BUILTIN_PRESETS: readonly TextPreset[];

/**
 * Resolve a preset ID (including legacy IDs) to a TextPreset.
 * Falls back to BUILTIN_PRESETS[0] if not found.
 */
export function getPreset(id: string): TextPreset;

/**
 * Apply per-clip style overrides to a resolved preset.
 * Returns a new TextPreset object — does not mutate the original.
 */
export function applyOverrides(
  preset: TextPreset,
  overrides: CaptionStyleOverrides,
): TextPreset;
```

---

## API Contracts

### POST /api/captions/transcribe

**Unchanged from current.** Only the response shape changes slightly.

Request:
```json
{ "assetId": "string" }
```

Response (200):
```json
{
  "captionDocId": "string",
  "words": [{ "word": "string", "startMs": 0, "endMs": 100 }],
  "fullText": "string"
}
```

**Breaking change:** `captionId` → `captionDocId` in the response. All call sites must update.

### GET /api/captions/doc/:captionDocId

Fetches the exact `CaptionDoc` referenced by a `CaptionClip`.

Response shape:

```json
{
  "captionDocId": "string",
  "words": [...],
  "fullText": "string",
  "language": "en",
  "source": "whisper"
}
```

This is the canonical read path for editor preview and export-related UI.

### GET /api/captions/:assetId

Convenience lookup for the latest caption doc associated with an asset. Used for idempotent auto-transcription and asset-level status, not clip rendering.

Response shape:

```json
{
  "captionDocId": "string",
  "words": [...],
  "fullText": "string",
  "source": "whisper"
}
```

**Breaking change:** `captionId` → `captionDocId`. Call sites must update.

### PATCH /api/captions/doc/:captionDocId (new)

Updates an existing caption doc after transcription.

Request:
```json
{
  "words": [{ "word": "ContentAI", "startMs": 0, "endMs": 420 }],
  "fullText": "ContentAI launches today",
  "language": "en"
}
```

Response (200):
```json
{
  "captionDocId": "string",
  "updatedAt": "2026-03-30T12:00:00.000Z"
}
```

Validation:
- Same ordering/non-overlap rules as create
- Empty docs are rejected
- `language` must remain `"en"` in v2
- Updates are in-place for the referenced `captionDocId`; preview and export both read the saved result

### POST /api/captions/manual (new)

Creates a `CaptionDoc` from manually entered word-timing data. Used for captions without an audio asset.

Request:
```json
{
  "assetId": "string | null",
  "words": [{ "word": "Hello", "startMs": 0, "endMs": 400 }],
  "fullText": "string",
  "language": "en"
}
```

Response (201):
```json
{ "captionDocId": "string" }
```

Validation:
- Words must be sorted by `startMs`.
- Each word's `startMs` must be < `endMs`.
- Words must not overlap (word[n].endMs <= word[n+1].startMs).
- `fullText` must not be empty.
- `language` must be `"en"` in v2.

---

## Database Schema Changes

### Rename `caption` → `caption_doc`

```sql
-- Migration: rename table
ALTER TABLE "caption" RENAME TO "caption_doc";

-- Add source column
ALTER TABLE "caption_doc"
  ADD COLUMN "source" text NOT NULL DEFAULT 'whisper'
  CHECK ("source" IN ('whisper', 'manual', 'import'));

-- Update indexes
ALTER INDEX "captions_asset_idx" RENAME TO "caption_doc_asset_idx";
ALTER INDEX "captions_user_idx" RENAME TO "caption_doc_user_idx";
ALTER INDEX "captions_user_asset_unique" RENAME TO "caption_doc_user_asset_unique";
```

### Drizzle Schema (new)

```typescript
// backend/src/infrastructure/database/drizzle/schema.ts

export const captionDocs = pgTable("caption_doc", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assetId:   text("asset_id").references(() => assets.id, { onDelete: "cascade" }), // nullable for manual
  language:  text("language").notNull().default("en").$type<"en">(),
  words:     jsonb("words").notNull().$type<Word[]>(),
  fullText:  text("full_text").notNull(),
  source:    text("source").notNull().default("whisper").$type<"whisper" | "manual" | "import">(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Note: `assetId` is now nullable (for manual captions without an audio asset). The unique index `(userId, assetId)` still applies — but only for rows where `assetId IS NOT NULL`.

### Composition JSON: CaptionClip Shape

Clips stored in the `composition.timeline` JSONB column gain a new shape for caption clips:

```typescript
// Before (a text Clip with optional caption fields):
{
  id: "clip-123",
  assetId: "asset-abc",
  label: "Captions",
  startMs: 0,
  durationMs: 30000,
  captionId: "cap-xyz",
  captionWords: [...],     // 200+ words stored directly in composition!
  captionPresetId: "hormozi",
  captionGroupSize: 3,
  captionPositionY: 80,
}

// After (a CaptionClip, words live in caption_doc table):
{
  id: "clip-123",
  type: "caption",
  startMs: 0,
  durationMs: 30000,
  originVoiceoverClipId: "voiceover-123",
  captionDocId: "cap-xyz",   // FK → caption_doc.id
  sourceStartMs: 10000,
  sourceEndMs: 20000,
  stylePresetId: "hormozi",
  styleOverrides: { positionY: 80 },
  groupingMs: 1400,
}
```

**Critical improvement:** Words are no longer stored in the composition JSONB. The `captionWords` array (potentially 200+ items for a 2-minute voiceover) was stored redundantly — once in `caption_doc.words` and once inside every clip. The new design stores words once.

**Related change:** We will also stop sending the raw AI-generated voiceover script through this flow. Instead, we will rely on auto-transcription to derive the caption text and create separate clips for each transcribed segment.

---

## Editor Reducer Changes

### New Action Types

```typescript
// frontend/src/features/editor/types/editor.ts

type EditorAction =
  // ... existing actions ...
  | {
      type: "ADD_CAPTION_CLIP";
      captionDocId: string;
      assetId: string;
      originVoiceoverClipId?: string;
      startMs: number;
      durationMs: number;
      sourceStartMs: number;
      sourceEndMs: number;
      presetId?: string;    // defaults to "hormozi"
      groupingMs?: number;  // defaults to preset.groupingMs
    }
  | {
      type: "UPDATE_CAPTION_STYLE";
      clipId: string;
      presetId?: string;
      overrides?: CaptionStyleOverrides;
      groupingMs?: number;
    };
```

### Removed Action Types

`ADD_CAPTION_CLIP` currently sets `captionWords` on the clip. The new action does not. Words are loaded separately via `useCaptionDoc`.

---

## React Hook Contracts

```typescript
// features/editor/caption/hooks/useTranscription.ts
// Uses useAuthenticatedFetch() internally, matching existing mutation hooks.
export function useTranscription(): UseMutationResult<
  { captionDocId: string; words: Word[]; fullText: string },
  Error,
  { assetId: string }
>;

// features/editor/caption/hooks/useCaptionDoc.ts
// Uses useQueryFetcher() internally, matching existing query hooks.
export function useCaptionDoc(captionDocId: string | null): UseQueryResult<CaptionDoc | null>;

// features/editor/caption/hooks/useUpdateCaptionDoc.ts
// Uses useAuthenticatedFetch() internally, matching existing mutation hooks.
export function useUpdateCaptionDoc(): UseMutationResult<
  { captionDocId: string; updatedAt: string },
  Error,
  { captionDocId: string; words: Word[]; fullText: string; language: "en" }
>;

// features/editor/caption/hooks/useCaptionCanvas.ts
/**
 * Manages the canvas ref, font loading, page computation, layout caching,
 * and animation frame loop for caption rendering.
 *
 * Returns a ref to attach to the caption canvas element.
 */
export function useCaptionCanvas(
  captionClip: CaptionClip | null,
  captionDoc: CaptionDoc | null,
  currentTimeMs: number,
  canvasW: number,
  canvasH: number,
): React.RefObject<HTMLCanvasElement>;
```

---

## Query Key Changes

```typescript
// frontend/src/shared/lib/query-keys.ts
// Keep caption keys under queryKeys.api.* to match the existing codebase.

// Before:
captionsByAsset: (assetId: string) => ["captions", "asset", assetId] as const

// After:
captionDoc: (captionDocId: string) =>
  ["api", "captions", "doc", captionDocId] as const
captionDocByAsset: (assetId: string) =>
  ["api", "captions", "asset", assetId] as const
```

---

## Translation Key Changes

Remove all existing `editor_captions_*` keys. Add:

| New Key | Value |
|---------|-------|
| `caption_style_label` | "Caption style" |
| `caption_position_y` | "Position Y" |
| `caption_font_size` | "Font size" |
| `caption_grouping` | "Caption pacing" |
| `caption_transcribing` | "Transcribing audio..." |
| `caption_transcription_failed` | "Transcription failed. Try again." |
| `caption_export_approximated` | "Some effects simplified in export" |
| `caption_edit_transcript` | "Edit transcript" |
| `caption_timing_label` | "Token timing" |
| `caption_sync_warning` | "This caption style changes on export" |
| `caption_language_scope` | "English only" |

---

## Component Specifications

### `CaptionPresetPicker`

Replaces `InspectorTextAndCaptionPanels.tsx` caption section.

Props:
```typescript
interface CaptionPresetPickerProps {
  selectedPresetId: string;
  onSelect: (presetId: string) => void;
}
```

Renders: 2-column grid of preset tiles. Each tile shows:
- Preset name
- Live miniature canvas preview (static snapshot at t=0 of the entry animation)

No longer renders sliders — those are in `CaptionStylePanel`.

### `CaptionStylePanel`

Inspector panel for per-clip overrides.

Props:
```typescript
interface CaptionStylePanelProps {
  clip: CaptionClip;
  onUpdateOverrides: (overrides: CaptionStyleOverrides) => void;
  onUpdateGroupingMs: (ms: number) => void;
}
```

Renders: three sliders — Position Y (0–100%), Font Size (24–96px), Caption pacing (400ms–2400ms), plus an export-fidelity badge derived from the preset's `exportMode`.

### `CaptionTranscriptEditor`

New inspector panel for correcting caption content after transcription.

Props:
```typescript
interface CaptionTranscriptEditorProps {
  clip: CaptionClip;
  captionDoc: CaptionDoc;
  onSave: (next: { words: Word[]; fullText: string; language: "en" }) => void;
}
```

Renders:
- Full transcript text area for quick copy edits
- Token list with editable `word`, `startMs`, and `endMs`
- Split/merge token actions
- Reset-to-transcription action for discarding unsaved local edits

Rules:
- Saves update the existing `captionDocId` rather than creating a second hidden doc
- Validation errors are inline and block save
- Preview re-renders from the saved doc response so editor and export stay aligned
- The UI must label this feature as English-only; non-English input is out of scope for v2
