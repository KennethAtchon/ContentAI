# Light Theme Migration Guide

## Overview

The app currently uses a dark-only theme. The `ThemeProvider` already supports `"light"`, `"dark"`, and `"system"` modes and correctly toggles a `.light` or `.dark` class on `<html>` — but **no light-mode CSS variables are defined**, so the `.light` class does nothing.

This guide explains exactly what to change to make a full white/light theme work.

---

## How the Theme System Works

```
ThemeProvider (storageKey: "ui-theme")
  └─ adds .dark or .light to <html>
        └─ globals.css: :root defines all primitives (currently dark only)
              └─ Studio aliases (--studio-bg, --studio-fg, etc.)
                    └─ shadcn/ui semantic tokens (--background, --foreground, etc.)
                          └─ Tailwind utilities (bg-background, text-foreground, etc.)
```

All colors are CSS custom properties. Swapping the theme = swapping those variables. No component code needs to change.

---

## Step 1 — Add Light Theme Variables to `globals.css`

**File:** `frontend/src/styles/globals.css`

Add this block **after** the existing `:root { ... }` block (around line 67):

```css
/* ═══════════════════════════════════════════════════════════════════════════
   LIGHT THEME — overrides applied when .light class is on <html>
   ═══════════════════════════════════════════════════════════════════════════ */

.light {
  /* 1. Brand palette — slightly deeper blue for contrast on white */
  --color-accent: 234 89% 58%;

  /* 2. Surface scale — white → near-white grays */
  --surface-0:   0 0% 100%;        /* main background: pure white        */
  --surface-1:   210 20% 97%;      /* card / sidebar: off-white          */
  --surface-2:   210 20% 93%;      /* elevated card: light gray          */
  --surface-top: 0 0% 100%;        /* topbar: white                      */

  /* 3. Text scale — dark ink on white */
  --text-primary: 222 47% 11%;
  --text-dim-1: hsl(222 47% 11% / 0.7);
  --text-dim-2: hsl(222 47% 11% / 0.45);
  --text-dim-3: hsl(222 47% 11% / 0.22);

  /* 4. Status colors — same as dark; they work on both backgrounds */
  --color-success: 160 84% 33%;
  --color-warning:  38 92% 42%;
  --color-error:     0 84% 54%;
  --color-info:    217 91% 52%;

  /* 5. Overlay scale — use black-tint overlays instead of white-tint */
  --overlay-xs: rgb(0 0 0 / 0.03);
  --overlay-sm: rgb(0 0 0 / 0.06);
  --overlay-md: rgb(0 0 0 / 0.10);
  --overlay-lg: rgb(0 0 0 / 0.16);

  /* ── Studio aliases ── */
  --studio-bg:       hsl(var(--surface-0));
  --studio-surface:  hsl(var(--surface-1));
  --studio-topbar:   hsl(var(--surface-top));
  --studio-accent:   hsl(var(--color-accent));
  --studio-purple:   hsl(270 75% 60%);
  --studio-fg:       hsl(var(--text-primary));
  --studio-fg-dim:   var(--text-dim-2);
  --studio-border:   var(--overlay-sm);
  --studio-ring:     hsl(var(--color-accent) / 0.4);

  /* ── Sidebar ── */
  --sidebar:                    hsl(var(--surface-1));
  --sidebar-foreground:         hsl(var(--text-primary));
  --sidebar-primary:            hsl(var(--color-accent));
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent:             hsl(210 20% 91%);
  --sidebar-accent-foreground:  hsl(var(--text-primary));
  --sidebar-border:             hsl(210 20% 86%);
  --sidebar-ring:               hsl(var(--color-accent));
}

/* ── Shadcn/ui semantic tokens for .light ───────────────────────────────── */

@layer base {
  .light {
    --background:              var(--surface-0);
    --foreground:              var(--text-primary);
    --card:                    var(--surface-1);
    --card-foreground:         var(--text-primary);
    --popover:                 hsl(0 0% 100%);
    --popover-foreground:      var(--text-primary);
    --primary:                 var(--color-accent);
    --primary-foreground:      0 0% 100%;
    --purple:                  270 75% 60%;
    --purple-foreground:       0 0% 100%;
    --gradient-from:           var(--color-accent);
    --gradient-via:            260 80% 65%;
    --gradient-to:             270 75% 60%;
    --secondary:               210 20% 91%;
    --secondary-foreground:    var(--text-primary);
    --muted:                   210 20% 93%;
    --muted-foreground:        215 16% 47%;
    --accent:                  var(--color-accent);
    --accent-foreground:       0 0% 100%;
    --destructive:             var(--color-error);
    --destructive-foreground:  0 0% 100%;
    --border:                  210 20% 86%;
    --input:                   210 20% 90%;
    --ring:                    var(--color-accent);
    --chart-1:                 var(--color-accent);
    --chart-2:                 270 75% 60%;
    --chart-3:                 190 70% 42%;
    --chart-4:                 var(--color-success);
    --chart-5:                 var(--color-warning);
    --sidebar-background:      var(--surface-1);
    --sidebar-foreground:      var(--text-primary);
    --sidebar-primary:         var(--color-accent);
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent:          210 20% 91%;
    --sidebar-accent-foreground: var(--text-primary);
    --sidebar-border:          210 20% 86%;
    --sidebar-ring:            var(--color-accent);
  }
}
```

---

## Step 2 — Fix the Skeleton Utility

**File:** `frontend/src/styles/globals.css`

The `.studio-skeleton` uses white-based overlays which look wrong on a white background. Conditionally invert them:

```css
/* replace the existing .studio-skeleton in @layer components */
.studio-skeleton {
  background: linear-gradient(
    90deg,
    var(--overlay-xs) 25%,
    var(--overlay-sm) 50%,
    var(--overlay-xs) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}
```

Since `--overlay-xs` and `--overlay-sm` are already flipped to black-tint in `.light` (Step 1), the skeleton will automatically adapt. No further change needed.

---

## Step 3 — Fix the `.studio-phone-shadow`

The current shadow uses hard black values that look too heavy on white. Override in `.light`:

```css
/* Add inside the .light block in @layer components */
@layer components {
  .light .studio-phone-shadow {
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.06),
      0 40px 80px rgb(0 0 0 / 0.12),
      0 0 60px hsl(var(--color-accent) / 0.08);
  }
}
```

---

## Step 4 — Fix the Film Strip Utility

**`.bg-repeating-sprocket`** uses `rgba(0,0,0,0.4)` — this already works on light backgrounds. No change needed.

---

## Step 5 — Add a Theme Toggle UI

The `ThemeProvider` already wires everything up. You just need a button that calls `setTheme`.

**Minimal toggle component** (create at `src/shared/components/theme-toggle.tsx`):

```tsx
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/shared/providers/theme-provider";
import { Button } from "@/shared/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next: Record<string, "light" | "dark" | "system"> = {
    dark: "light",
    light: "system",
    system: "dark",
  };

  const icons = {
    dark: <Moon className="h-4 w-4" />,
    light: <Sun className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next[theme])}
      aria-label="Toggle theme"
    >
      {icons[theme]}
    </Button>
  );
}
```

Drop `<ThemeToggle />` wherever you want (topbar, settings page, etc.).

---

## Step 6 — Translation Key

Add the theme toggle label to `frontend/src/translations/en.json`:

```json
"theme": {
  "dark": "Dark",
  "light": "Light",
  "system": "System",
  "toggle": "Toggle theme"
}
```

---

## Step 7 — Verify the `@theme inline` Sidebar Aliases

The `@theme inline` block in `globals.css` maps `--sidebar` → `--color-sidebar` for Tailwind's opacity-modifier support. Since the `.light` block sets `--sidebar` (the source variable), this mapping propagates automatically. **No change needed** to the `@theme inline` block.

---

## What Does NOT Need to Change

| What | Why |
|---|---|
| `ThemeProvider` | Already supports `.light` class toggling |
| All shadcn/ui components | Use semantic tokens (`bg-card`, `text-foreground`, etc.) which auto-adapt |
| `tailwind.config.ts` | References CSS vars; adapts automatically |
| Route/page components | Use semantic utilities, not hardcoded colors |
| Backend | Unrelated to theming |

---

## Known Edge Cases to Manually Audit

After applying the changes above, scan for these patterns that bypass the token system:

```bash
# Hardcoded dark colors (replace with semantic tokens)
grep -r "bg-\[#" frontend/src --include="*.tsx"
grep -r "text-\[#" frontend/src --include="*.tsx"

# Hardcoded white/black overlays (might need .light variant)
grep -r "bg-white/" frontend/src --include="*.tsx"
grep -r "bg-black/" frontend/src --include="*.tsx"

# Direct slate/zinc/gray color usage (may not respect theme)
grep -rE "bg-(slate|zinc|gray|neutral)-[0-9]" frontend/src --include="*.tsx"
grep -rE "text-(slate|zinc|gray|neutral)-[0-9]" frontend/src --include="*.tsx"
```

For each match, replace with the appropriate semantic token:
- `bg-slate-900` → `bg-background`
- `text-slate-100` → `text-foreground`
- `bg-white/10` → `bg-overlay-sm`
- `bg-black/50` → use `bg-black/50` only for pure overlays (modals), otherwise use `bg-muted`

---

## Summary of Changes

| File | Change |
|---|---|
| `frontend/src/styles/globals.css` | Add `.light { }` primitive block + `@layer base .light { }` semantic token block + `.light .studio-phone-shadow` override |
| `frontend/src/translations/en.json` | Add `theme.*` keys |
| `frontend/src/shared/components/theme-toggle.tsx` | Create new toggle component |

The `ThemeProvider` default is `"dark"`. To make `"light"` the default, change:

```tsx
// frontend/src/main.tsx
<ThemeProvider defaultTheme="light" storageKey="ui-theme">
```

Or leave it as `"dark"` and let users toggle.
