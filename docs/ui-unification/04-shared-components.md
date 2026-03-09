# Shared Components Refactoring — Detailed Plan

This document details the exact file-level changes needed for every shared component used across the application, including both foundation components, form components, and the CSS/Tailwind configuration.

---

## Phase 0: CSS Foundation Changes

### File: `frontend/src/styles/globals.css`

This is the **single most impactful change** — overriding the base CSS custom properties to dark values will cause all shadcn components to automatically render dark.

#### Changes:

**1. Override `:root` base color variables (inside `@layer base`)**

Replace the existing light-mode values (lines 77-118) with dark-studio values:

```css
@layer base {
  :root {
    --font-inter: "Plus Jakarta Sans";  /* Override to use studio font globally */
    --font-lora: "Plus Jakarta Sans";
    --background: 230 25% 4%;           /* #08080F */
    --foreground: 214 32% 91%;          /* #E2E8F0 (studio-fg) */
    --card: 240 28% 7%;                 /* #0C0C18 (studio-surface) */
    --card-foreground: 214 32% 91%;
    --popover: 240 28% 7%;
    --popover-foreground: 214 32% 91%;
    --primary: 234 89% 74%;             /* #818CF8 (studio-accent) */
    --primary-foreground: 0 0% 100%;
    --purple: 270 91% 75%;             /* #C084FC (studio-purple) */
    --purple-foreground: 0 0% 100%;
    --gradient-from: 234 89% 74%;
    --gradient-via: 260 90% 75%;
    --gradient-to: 270 91% 75%;
    --secondary: 240 6% 10%;
    --secondary-foreground: 214 32% 91%;
    --muted: 240 6% 10%;
    --muted-foreground: 214 20% 55%;
    --accent: 234 89% 74%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 6% 20%;
    --input: 240 6% 15%;
    --ring: 234 89% 74%;
    --chart-1: 234 89% 74%;
    --chart-2: 270 91% 75%;
    --chart-3: 190 80% 50%;
    --chart-4: 150 60% 50%;
    --chart-5: 45 90% 65%;
    --radius: 0.625rem;
    --sidebar-background: 240 28% 7%;
    --sidebar-foreground: 214 32% 91%;
    --sidebar-primary: 234 89% 74%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 6% 14%;
    --sidebar-accent-foreground: 214 32% 91%;
    --sidebar-border: 240 6% 20%;
    --sidebar-ring: 234 89% 74%;
  }
}
```

**2. Update the body base styles**

```css
body {
  @apply bg-studio-bg text-studio-fg font-studio antialiased;
}
```

**3. Update heading defaults**

```css
h1, h2, h3, h4, h5, h6 {
  @apply font-studio font-bold tracking-tight;
}

button, .btn {
  @apply font-studio;
}
```

**4. Update utility classes**

```css
@layer utilities {
  .gradient-text {
    @apply bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent;
  }

  .saas-card {
    @apply rounded-[14px] border border-white/[0.06] bg-white/[0.03] 
           transition-all hover:border-studio-accent/30;
  }

  .saas-button {
    @apply rounded-lg font-medium transition-opacity hover:opacity-85;
  }
}
```

**5. Update the outer `:root` sidebar variables (lines 159-168)**

Replace with dark values matching the studio palette.

**6. Remove `.dark` class overrides (lines 170-179)** — no longer needed since the base is already dark.

---

### File: `frontend/tailwind.config.ts`

**Changes:**

1. Update `fontFamily.sans` to use `var(--font-studio)` as the primary font:
```ts
sans: ["var(--font-studio)", "system-ui", "sans-serif"],
```

2. This ensures all `font-sans` usage automatically maps to Plus Jakarta Sans.

---

## Phase 1: Layout Shell

### New File: `frontend/src/shared/components/layout/studio-shell.tsx`

```tsx
import { ReactNode } from "react";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { StudioFooter } from "./studio-footer";

export type ShellVariant = "studio" | "public" | "customer" | "admin" | "auth";

interface StudioShellProps {
  variant: ShellVariant;
  children: ReactNode;
  showFooter?: boolean;
  activeTab?: string;
  // Studio-specific (only when variant === "studio")
  niche?: string;
  onNicheChange?: (n: string) => void;
  onScan?: () => void;
}

export function StudioShell({
  variant,
  children,
  showFooter = false,
  activeTab,
  niche,
  onNicheChange,
  onScan,
}: StudioShellProps) {
  return (
    <div className="h-screen bg-studio-bg text-studio-fg font-studio 
                    grid grid-rows-[48px_1fr] overflow-hidden">
      <StudioTopBar
        variant={variant}
        activeTab={activeTab}
        niche={niche}
        onNicheChange={onNicheChange}
        onScan={onScan}
      />
      <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <main>{children}</main>
        {showFooter && <StudioFooter />}
      </div>
    </div>
  );
}
```

### Modified File: `frontend/src/features/studio/components/StudioTopBar.tsx`

Add `variant` prop to support multiple navigation modes. Preserve existing studio behavior for `variant="studio"`.

Key additions:
- Import and use `useApp()` for auth state
- Import `UserButton` for authenticated user display
- Import navigation link arrays for each variant
- Implement mobile menu overlay

### New File: `frontend/src/shared/components/layout/studio-footer.tsx`

Minimal dark-themed footer with link columns and copyright.

### New File: `frontend/src/shared/components/layout/studio-hero.tsx`

Dark-themed hero section with studio design tokens.

### New File: `frontend/src/shared/components/custom-ui/studio-feature-card.tsx`

Dark glass feature card with studio accent icon.

### New File: `frontend/src/shared/components/custom-ui/studio-section.tsx`

Dark section wrapper replacing the light `Section` component.

---

## Phase 2: shadcn Component Overrides

Since the CSS variable override approach in Phase 0 already handles most shadcn components, here are the remaining components that may need **additional** inline class adjustments:

### `frontend/src/shared/components/ui/button.tsx`
- The default variant should use studio-accent as primary color (handled by CSS var override)
- Add a new `gradient` variant:
```tsx
gradient: "bg-gradient-to-br from-studio-accent to-studio-purple text-white border-0 hover:opacity-85",
```

### `frontend/src/shared/components/ui/card.tsx`
- The CSS override maps `--card` to `#0C0C18`
- For additional styling, pages should add: `border-white/[0.06] rounded-[14px]`

### `frontend/src/shared/components/ui/input.tsx`
- The CSS override maps `--input` to a dark tone
- Add to the base cn: `bg-white/[0.05] border-white/[0.08] text-studio-fg placeholder:text-slate-200/20`

### `frontend/src/shared/components/ui/tabs.tsx`
- `TabsList`: Override bg to `bg-white/[0.03] border border-white/[0.06]`
- `TabsTrigger` active: `data-[state=active]:bg-studio-accent/[0.08] data-[state=active]:text-studio-accent`

### `frontend/src/shared/components/ui/accordion.tsx`
- Border color should automatically pick up the dark `--border` value
- Trigger hover: ensure `hover:no-underline` is preserved

### `frontend/src/shared/components/ui/alert.tsx`
- Destructive: `bg-red-400/[0.08] border-red-400/20 text-red-400`
- Default success: `bg-green-400/[0.08] border-green-400/20 text-green-400`

### `frontend/src/shared/components/ui/badge.tsx`
- Outline variant: `border-white/[0.08] text-slate-200/50 bg-white/[0.04]`

### `frontend/src/shared/components/ui/label.tsx`
- Text should default to: `text-[11px] font-semibold text-slate-200/50`

---

## Phase 3: Feature-Specific Components

### `frontend/src/features/auth/components/auth-guard.tsx`
- Loading spinner: Replace `Loader2` spinner with `studio-skeleton` shimmer
- Full-screen: Ensure dark background

### `frontend/src/features/auth/components/user-button.tsx`
- Ensure avatar/dropdown uses dark popover styles

### `frontend/src/features/account/components/subscription-management.tsx`
- All cards: Dark card pattern
- Status indicators: Studio status color scheme
- Buttons: Studio gradient/ghost patterns

### `frontend/src/features/account/components/usage-dashboard.tsx`
- Stats: Studio metric card pattern
- Charts: Use studio color palette

### `frontend/src/features/account/components/profile-editor.tsx`
- Form: Dark input pattern
- Labels: Studio label styling

### `frontend/src/features/admin/components/dashboard/dashboard-layout.tsx`
- Replace with `StudioShell variant="admin"`, or restyle to use:
  - Dark sidebar: `bg-studio-surface border-white/[0.05]`
  - Dark content area: `bg-studio-bg`

---

## File Impact Summary

| Action | File Count |
|---|---|
| **New files** to create | 5 |
| **Shared components** to modify | ~15 |
| **Route files** to modify | ~25 |
| **CSS/config files** to modify | 2 |
| **Files to delete** (after migration) | ~6 |
| **Total files touched** | ~47 |
