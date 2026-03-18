# Theme Centralization Plan

**Goal:** Change a few files and completely change the theme of the app (colors, fonts, etc.). All UI should consistently derive from centralized tokens so theme changes propagate everywhere.

---

## Current State Summary

Based on a full audit of the frontend:

- **~46 files** use hardcoded Tailwind palette colors (`text-slate-200/45`, `bg-emerald-600`, etc.) that bypass the token system
- **Three overlapping token layers** in `globals.css` (studio raw tokens, shadcn semantic tokens, sidebar tokens defined twice)
- **ThemeProvider** always forces `"light"` class; `dark:` variants never fire
- **Stale `src/tailwind.config.ts`** references Inter/Lora fonts that are not loaded
- **Font tokens** exist but `font-mono` vs `font-studio-mono` usage is inconsistent

---

## Phase 1 — Consolidate the Single Source of Truth

**Files to change:** `frontend/src/styles/globals.css`, `frontend/tailwind.config.ts`  
**Files to delete:** `frontend/src/tailwind.config.ts` (stale/orphaned)

Consolidate all token definitions into one clean `:root` block with a clear hierarchy:

```
Primitive palette → Semantic roles → Component tokens
```

### New Token Structure (in `globals.css`)

```css
/* globals.css — the ONLY file you touch to change the theme */
:root {
  /* 1. Brand palette (raw values) */
  --color-accent:      234 89% 74%;   /* indigo today, swap to any hue */
  --color-accent-dim:  240 28% 7%;

  /* 2. Surface scale */
  --surface-0: 230 25% 4%;   /* deepest bg */
  --surface-1: 240 28% 7%;   /* card */
  --surface-2: 240 25% 10%;  /* elevated card */
  --surface-top: 232 26% 9%; /* topbar */

  /* 3. Text scale */
  --text-primary:  214 32% 91%;
  --text-dim-1:    214 32% 91% / 0.7;  /* replaces slate-200/70 */
  --text-dim-2:    214 32% 91% / 0.45; /* replaces slate-200/45 */
  --text-dim-3:    214 32% 91% / 0.25; /* replaces slate-200/25 */

  /* 4. Status colors */
  --color-success: 160 84% 39%;
  --color-warning: 38 92% 50%;
  --color-error:   0 84% 60%;
  --color-info:    217 91% 60%;

  /* 5. Overlay scale (replaces white/[0.X]) */
  --overlay-xs:  255 255 255 / 0.03;
  --overlay-sm:  255 255 255 / 0.06;
  --overlay-md:  255 255 255 / 0.10;

  /* 6. Typography */
  --font-body:    "Plus Jakarta Sans", sans-serif;
  --font-mono:    "Fira Code", "JetBrains Mono", monospace;
}
```

Shadcn/ui vars (`--primary`, `--background`, etc.) reference these primitives and do not need editing when changing themes.

`tailwind.config.ts` gets matching aliases (`text-dim-1`, `text-dim-2`, `bg-surface-0`, `text-success`, etc.).

---

## Phase 2 — Tokenize the Remaining Hardcoded Patterns

Replace hardcoded usages across ~46 files. Four main patterns:

| Pattern | Replace With | Files Affected |
|---------|--------------|----------------|
| `text-slate-200/22` → `text-slate-200/55` | `text-dim-3` → `text-dim-1` | ~35 editor files |
| `bg-emerald-*`, `text-emerald-*` | `bg-success`, `text-success` | ~8 files |
| `text-red-*`, `bg-red-*` | `text-error`, `bg-error` | ~6 files |
| `text-amber-*` | `text-warning` | ~4 files |
| `bg-white/[0.03]`, `border-white/[0.06]` | `bg-overlay-xs`, `border-overlay-sm` | ~14 editor files |
| Raw hex `#0a0a0c`, `#111`, `#0E0E1A` | `bg-surface-0`, `bg-surface-top` | `TimelineStrip`, `PhonePreview` |

Port legacy light-mode colors in `breadcrumb.tsx` and `error-boundary.tsx` to token-based dark theme classes.

---

## Phase 3 — Fix Fonts

- Change the single `@import` line in `globals.css` to load a different font family; `--font-body` propagates via `font-sans` / `font-studio`
- Remove dead `--font-inter` / `--font-lora` vars
- Align `font-mono` with `font-studio-mono` (or make them one alias)

---

## Phase 4 — Fix ThemeProvider (Optional)

**File:** `frontend/src/shared/providers/theme-provider.tsx`

The provider always forces the `"light"` class on `<html>`, so `dark:` Tailwind variants never fire. Fix it to actually apply `.dark` when appropriate. Since the app is effectively dark-only today, the simplest fix: default to `"dark"` and apply that class so `dark:` variants work for future light/dark switching.

---

## End State

After completion, changing the theme requires editing only:

| What to Change | File to Edit |
|----------------|--------------|
| Accent/brand color | `globals.css` — `--color-accent` |
| Background darkness | `globals.css` — `--surface-0` through `--surface-top` |
| Text contrast | `globals.css` — `--text-primary` + `--text-dim-*` |
| Status colors | `globals.css` — `--color-success/warning/error/info` |
| Fonts | `globals.css` — `@import` URL + `--font-body` |

Nothing else needs to change.

---

## Execution Order

1. **Phase 1** — Define new token system in `globals.css`, update `tailwind.config.ts`, delete stale config. No visual regressions if current values are preserved.
2. **Phase 2** — Replace hardcoded usages file-by-file (editor features first).
3. **Phase 3** — Clean up font setup.
4. **Phase 4** — Fix ThemeProvider.
