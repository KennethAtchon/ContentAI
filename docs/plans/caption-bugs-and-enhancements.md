# Caption System — Bugs & Enhancements Plan

**Date:** 2026-04-07  
**Scope:** Fix 3 bugs + 1 enhancement in the caption inspector and preview pipeline  
**Files touched:** ~6 files across backend and frontend

---

## Problem Summary

Four issues reported after the caption feature was shipped:

| # | Severity | Description |
|---|----------|-------------|
| 1 | Critical | Nothing renders on the preview canvas for caption clips |
| 2 | UI | "Caption Style" section overflows the inspector panel |
| 3 | Bug | Cannot switch caption preset — no preset buttons appear |
| 4 | Enhancement | No visual preview of what each caption preset looks like |

Issues 1 and 3 share the same root cause.

---

## Bug 1 — Caption Preview Is Blank (Critical)

### Root Cause

The `caption_preset` database table is empty. The seeded presets defined in `backend/src/domain/editor/captions/preset-seed.ts` are **never inserted anywhere in production code** — the file is only imported by unit tests.

Trace the failure:

```
GET /api/captions/presets
  └─ captionsService.listPresets()
       └─ CaptionPresetRepository.listCaptionPresets()
            └─ SELECT * FROM caption_preset   →  0 rows  →  []
```

In `frontend/src/features/editor/components/PreviewArea.tsx` (lines 115–129):

```ts
const { data: captionPresets } = useCaptionPresets();        // [] — empty
const activeCaptionPreset = useMemo(() => {
  const preset = captionPresets?.find(                        // find() on [] → undefined
    (item) => item.id === activeCaptionClip?.stylePresetId
  );
  if (!preset || !activeCaptionClip) return null;            // → null
  return applyCaptionStyleOverrides(preset, ...);
}, [captionPresets, activeCaptionClip]);

const captionCanvasRef = useCaptionCanvas({
  clip: activeCaptionClip,
  doc: activeCaptionDoc ?? null,
  preset: activeCaptionPreset,   // null — always
  ...
});
```

In `frontend/src/features/editor/caption/hooks/useCaptionCanvas.ts` (line 40):

```ts
if (!clip || !doc || !preset) return;  // exits immediately — canvas never drawn
```

### Fix

**Add auto-seeding to `CaptionPresetRepository.listCaptionPresets()`.**

When the table is empty, insert `SEEDED_CAPTION_PRESETS` and return them. This is safe and idempotent for a dev environment where `db:reset` is routine.

**File:** `backend/src/domain/editor/captions/preset.repository.ts`

```ts
import { SEEDED_CAPTION_PRESETS } from "./preset-seed";

async listCaptionPresets(): Promise<CaptionPresetRecord[]> {
  if (this.listCache) return this.listCache;

  const rows = await this.db.select().from(captionPresets);

  // Auto-seed on first call if table is empty
  if (rows.length === 0) {
    await this.db.insert(captionPresets).values(
      SEEDED_CAPTION_PRESETS.map((preset) => ({
        id: preset.id,
        definition: preset as unknown as Record<string, unknown>,
      }))
    );
    // Re-fetch after insert
    const seeded = await this.db.select().from(captionPresets);
    const mapped = seeded.map(mapRow).sort((a, b) => a.id.localeCompare(b.id));
    this.listCache = mapped;
    for (const p of mapped) this.cache.set(p.id, p);
    return mapped;
  }

  const mapped = rows.map(mapRow).sort((a, b) => a.id.localeCompare(b.id));
  this.listCache = mapped;
  for (const p of mapped) this.cache.set(p.id, p);
  return mapped;
}
```

Also add `bun run db:seed` as an explicit npm script that inserts `SEEDED_CAPTION_PRESETS` so `db:reset` users can re-seed manually without restarting the server.

**Script:** `backend/scripts/db-seed.ts`

```ts
import { db } from "../src/infrastructure/database/drizzle/db";
import { captionPresets } from "../src/infrastructure/database/drizzle/schema";
import { SEEDED_CAPTION_PRESETS } from "../src/domain/editor/captions/preset-seed";

await db.insert(captionPresets)
  .values(SEEDED_CAPTION_PRESETS.map((p) => ({
    id: p.id,
    definition: p as unknown as Record<string, unknown>,
  })))
  .onConflictDoNothing();

console.log(`Seeded ${SEEDED_CAPTION_PRESETS.length} caption presets.`);
process.exit(0);
```

Add to `backend/package.json`:

```json
"db:seed": "bun run scripts/db-seed.ts"
```

And update `db:reset` to run `db:seed` at the end.

### Verification

1. Run `bun run db:reset` then `bun run dev`
2. Open editor with a voiceover clip, create captions
3. Scrub timeline — captions should render on canvas
4. Network tab: `GET /api/captions/presets` should return 10 preset objects

---

## Bug 2 — "Caption Style" Section Overflows the Inspector

### Root Cause

The inspector container is `width: 244px` with `p-3` (12px padding each side) = **220px** usable width. Inside `CaptionStylePanel`, the text-transform row (`InspectorPropRow`) puts three buttons — **None / Uppercase / Lowercase** — side by side in a `flex gap-1` div with no wrapping.

**File:** `frontend/src/features/editor/caption/components/CaptionStylePanel.tsx` (line 54–76)

The `InspectorPropRow` layout:

```tsx
<div className="flex items-center justify-between gap-2 py-0.5 min-w-0">
  <span className="text-xs text-dim-2 shrink-0">{label}</span>  {/* ~35px label */}
  <div className="flex gap-1">
    <button>None</button>       {/* ~38px */}
    <button>Uppercase</button>  {/* ~65px */}
    <button>Lowercase</button>  {/* ~65px */}
  </div>
</div>
```

Three buttons = ~168px + 2×4px gaps + ~35px label + 8px gap = **219px**. Right at the edge. With i18n overhead or browser rendering variance it overflows. `min-w-0` on the row doesn't propagate to the flex children so the inner div still expands.

### Fix

**Option A (Preferred):** Shrink label text to abbreviations and add `flex-wrap` to the buttons div so it can wrap if needed.

**File:** `frontend/src/features/editor/caption/components/CaptionStylePanel.tsx`

Change the text-transform block:

```tsx
<InspectorPropRow label={t("editor_caption_text_case_label")}>
  <div className="flex gap-1 flex-wrap justify-end">
    {(["none", "uppercase", "lowercase"] as const).map((value) => (
      <button
        key={value}
        type="button"
        onClick={() => onUpdateStyle({ overrides: { ...clip.styleOverrides, textTransform: value } })}
        className={[
          "rounded border px-1.5 py-0.5 text-[10px]",
          (clip.styleOverrides.textTransform ?? "none") === value
            ? "border-studio-accent bg-studio-accent/10 text-studio-accent"
            : "border-overlay-sm bg-overlay-sm text-dim-2",
        ].join(" ")}
      >
        {t(`editor_caption_text_case_${value}`)}
      </button>
    ))}
  </div>
</InspectorPropRow>
```

**Option B:** Use single-letter icons (`Aa`, `AA`, `aa`) as button labels to keep them compact. More concise but less obvious.

Also verify there's no outer element without `overflow-x-hidden` that lets content escape the 244px boundary. The inspector's scrollable div already has `overflow-x-hidden` (line 159 in Inspector.tsx) — confirm that propagates correctly with `min-w-0` on all flex children inside.

### Verification

1. Select a caption clip
2. Inspector should show Caption Style, Caption Preset, and Transcript sections all within the panel width — no horizontal overflow
3. Resize inspector area to confirm no reflow issues

---

## Bug 3 — Cannot Switch Caption Preset

### Root Cause

**Same root cause as Bug 1.** When `captionPresets = []`, `CaptionPresetPicker` renders no buttons:

```tsx
{presets.map((preset) => {    // presets = [] → no buttons rendered
  return <button ...>{preset.name}</button>;
})}
```

There is nothing to click. The reducer logic for `UPDATE_CAPTION_STYLE` is correct (lines 166–190 in `editor-reducer-clip-ops.ts`) — `stylePresetId` gets patched and autosave picks it up.

**Fix:** Covered entirely by fixing Bug 1 (seeding the DB).

### Secondary check after Bug 1 is fixed

After presets are seeded, verify the `useCaptionPresets` TanStack Query cache invalidates properly when you navigate between clips. The query key is `queryKeys.api.captionPresets()` and it has no dependencies on clip state, so the preset list is fetched once and cached globally. This is correct — preset list doesn't change per-clip.

### Verification

1. With seeded presets, select a caption clip
2. Inspector → Preset section shows 10 preset buttons
3. Click "Dark Box" — clip's `stylePresetId` changes in reducer
4. Preview canvas re-renders with new style within the next frame tick
5. Undo works (preset change is in undo stack)

---

## Enhancement 4 — Visual Preview of Caption Presets in Picker

### Current State

`CaptionPresetPicker` only shows the preset name + export mode + grouping ms as text. Users have no way to know what each preset looks like without applying it.

**File:** `frontend/src/features/editor/caption/components/CaptionPresetPicker.tsx`

### Plan

Add a **mini style swatch** inside each preset button that visually communicates the preset's key properties using CSS (not canvas). This avoids the complexity of spinning up a canvas render per button while still giving a meaningful preview.

The swatch renders a short sample phrase ("Hello World") styled with:
- Font weight from `typography.fontWeight`
- Text color from the first `FillLayer.color`
- Text stroke approximated via CSS `text-shadow` when a `StrokeLayer` exists
- Background from `BackgroundLayer.color` (line mode only)
- Font size scaled down proportionally (e.g. `fontSize / 4` clamped to 10–18px)

```tsx
function PresetSwatch({ preset }: { preset: TextPreset }) {
  const fill = preset.layers.find((l): l is FillLayer => l.type === "fill");
  const stroke = preset.layers.find((l): l is StrokeLayer => l.type === "stroke");
  const bg = preset.layers.find((l): l is BackgroundLayer => l.type === "background");

  const color = fill?.color ?? "#FFFFFF";
  const fontSize = Math.max(10, Math.min(18, Math.round(preset.typography.fontSize / 4)));
  const fontWeight = preset.typography.fontWeight;

  const textShadow = stroke
    ? `0 0 ${stroke.width}px ${stroke.color}, 0 0 ${stroke.width}px ${stroke.color}`
    : "0 1px 3px rgba(0,0,0,0.8)";

  const bgStyle = bg
    ? { background: bg.color, padding: "1px 4px", borderRadius: 2 }
    : {};

  return (
    <div
      className="rounded px-2 py-1 text-center overflow-hidden bg-black/40"
      style={{ minHeight: 28 }}
    >
      <span
        style={{
          color,
          fontSize,
          fontWeight,
          textShadow,
          textTransform: preset.typography.textTransform === "uppercase" ? "uppercase" : undefined,
          letterSpacing: preset.typography.letterSpacing,
          ...bgStyle,
        }}
      >
        HELLO WORLD
      </span>
    </div>
  );
}
```

Update the preset button in `CaptionPresetPicker` to include the swatch above the text metadata row:

```tsx
<button key={preset.id} type="button" onClick={() => onChange(preset.id)} className={...}>
  <PresetSwatch preset={preset} />
  <div className="mt-1 text-xs font-medium text-dim-1">{preset.name}</div>
  <div className="text-[10px] text-dim-3">
    {t(`editor_caption_export_mode_${preset.exportMode}`)},{" "}
    {t("editor_caption_grouping_value", { groupingMs: preset.groupingMs })}
  </div>
</button>
```

### What this communicates vs what it can't

| Property | Shown in swatch | Notes |
|---|---|---|
| Font weight | ✅ CSS font-weight | |
| Text color | ✅ CSS color | |
| Stroke | ~✅ text-shadow approx | Not pixel-perfect |
| Background box | ✅ CSS background | Line mode only |
| Word activation / pulse | ❌ | Too complex for static preview |
| Entry animations | ❌ | Static preview only |
| Active-state color (e.g. Karaoke) | ~✅ Show active color | Can show `stateColors.active` as note |

### Verification

1. Caption clip selected → inspector shows preset picker
2. Each preset button has a mini swatch showing approximate text style
3. Clicking a preset still calls `onChange` correctly
4. Swatch does not overflow the 244px inspector width
5. All 10 presets render a swatch without errors (including presets with background layers, glow, etc.)

---

## Implementation Order

```
1. Bug 1 + Bug 3 (same fix):
   - Create backend/scripts/db-seed.ts
   - Modify CaptionPresetRepository.listCaptionPresets() to auto-seed
   - Add db:seed to package.json
   - Run db:seed to populate presets now

2. Bug 2:
   - Fix CaptionStylePanel text-transform button overflow
   - Spot-check other InspectorSection children for similar overflow risks

3. Enhancement 4:
   - Add PresetSwatch component inside CaptionPresetPicker
   - Style per preset properties
   - Verify 10 presets all render correctly
```

---

## Files to Touch

| File | Change |
|------|--------|
| `backend/src/domain/editor/captions/preset.repository.ts` | Add auto-seed logic in `listCaptionPresets()` |
| `backend/scripts/db-seed.ts` | New — explicit seed script |
| `backend/package.json` | Add `db:seed` script |
| `frontend/src/features/editor/caption/components/CaptionStylePanel.tsx` | Fix text-transform button overflow |
| `frontend/src/features/editor/caption/components/CaptionPresetPicker.tsx` | Add `PresetSwatch` component + integrate |
