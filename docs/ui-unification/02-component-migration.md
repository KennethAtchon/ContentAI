# Component Migration Guide

This document provides a detailed component-by-component migration plan, mapping each existing shared component to its studio-themed equivalent.

---

## 1. `PageLayout` → `StudioShell`

**File**: `frontend/src/shared/components/layout/page-layout.tsx`

### Current Implementation
```tsx
// Light gradient wrapper with NavBar + Footer
<div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20">
  <NavBar />
  <main className="flex-1">{children}</main>
  <FooterCustom />
</div>
```

### Target Implementation
Create a new `StudioShell` component (or refactor `PageLayout`) that wraps all routes:

```tsx
interface StudioShellProps {
  children: ReactNode;
  /** Which top-bar tabs to show */
  variant: "studio" | "public" | "customer" | "admin" | "auth";
  /** Whether to show footer — only on public marketing pages */
  showFooter?: boolean;
  /** Active tab for the topbar navigation */
  activeTab?: string;
}

export function StudioShell({ children, variant, showFooter, activeTab }: StudioShellProps) {
  return (
    <div className="h-screen bg-studio-bg text-studio-fg font-studio 
                    grid grid-rows-[48px_1fr] overflow-hidden">
      <StudioTopBar variant={variant} activeTab={activeTab} />
      <main className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </main>
      {showFooter && <StudioFooter />}
    </div>
  );
}
```

### Migration Steps
1. Create `StudioShell` in `frontend/src/shared/components/layout/studio-shell.tsx`
2. Extend `StudioTopBar` to support different `variant` modes (public, customer, admin)
3. Create `StudioFooter` — a minimal dark footer
4. Update all routes to use `StudioShell` instead of `PageLayout`
5. Eventually deprecate/delete `PageLayout`

---

## 2. `NavBar` → Extended `StudioTopBar`

**File**: `frontend/src/shared/components/layout/navbar.tsx` → `frontend/src/features/studio/components/StudioTopBar.tsx`

### Current `NavBar` Features to Preserve
- Auth state awareness (show sign-in/sign-up vs UserButton)
- Mobile hamburger menu
- Active route highlighting
- Navigation links: Home, Pricing, FAQ, Contact, Studio, Account

### Target `StudioTopBar` Extensions

The existing `StudioTopBar` currently only supports studio tabs (discover, generate, queue). It needs to be extended:

```tsx
interface StudioTopBarProps {
  variant: "studio" | "public" | "customer" | "admin" | "auth";
  activeTab?: string;
  // Studio-specific props (only used when variant === "studio")
  niche?: string;
  onNicheChange?: (niche: string) => void;
  onScan?: () => void;
}
```

**Variant-specific behavior:**

| Variant | Left Section | Center/Tabs | Right Section |
|---|---|---|---|
| `studio` | Logo | Discover / Generate / Queue | Niche search + Scan |
| `public` | Logo | Home / Pricing / Features / FAQ / Contact | Sign In / Sign Up |
| `customer` | Logo | Studio / Account | UserButton |
| `admin` | Logo | Dashboard / Customers / Settings / Developer | UserButton |
| `auth` | Logo ← Back | — | — |

### Visual Changes
- **Keep**: The dark topbar background (`bg-studio-topbar`), 48px height, gradient logo, border-bottom
- **Add**: Auth-state-aware right section
- **Add**: Mobile menu overlay (dark themed, matching `bg-studio-surface`)

### Migration Steps
1. Extend `StudioTopBar` with `variant` prop and conditional rendering
2. Port auth-state logic from `NavBar` (user detection, sign-in/sign-up buttons)
3. Create dark-themed mobile menu component
4. Style all navigation links using studio tab pattern: `text-[13px]`, `border-b-2`, `text-slate-200/40` inactive
5. Delete old `NavBar` after all routes are migrated

---

## 3. `FooterCustom` → `StudioFooter`

**File**: `frontend/src/shared/components/layout/footer-custom.tsx`

### Target
A minimal dark footer for marketing/public pages only:

```tsx
export function StudioFooter() {
  return (
    <footer className="border-t border-white/[0.05] bg-studio-surface px-6 py-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[11px]">
          {/* Link columns */}
        </div>
        <div className="mt-6 pt-4 border-t border-white/[0.05] 
                       text-[10px] text-slate-200/25 text-center">
          © 2026 ReelStudio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

### Migration Steps
1. Create `StudioFooter` in `frontend/src/shared/components/layout/studio-footer.tsx`
2. Port link structure from `FooterCustom` but apply studio styling
3. Only render on `public` variant pages
4. Delete old `FooterCustom` when done

---

## 4. `HeroSection` → `StudioHero`

**File**: `frontend/src/shared/components/layout/hero-section.tsx`

### Current (Light)
```tsx
<section className="relative overflow-hidden border-b">
  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
  ...text-muted-foreground...
</section>
```

### Target (Dark)
```tsx
export function StudioHero({ badge, title, description, children }: StudioHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.05]">
      <div className="absolute inset-0 bg-gradient-to-br from-studio-accent/[0.04] 
                      via-studio-purple/[0.02] to-transparent" />
      <div className="max-w-[900px] mx-auto relative py-12 md:py-16 px-6 text-center">
        {badge && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full 
                         border border-white/[0.08] bg-white/[0.03] 
                         px-3.5 py-1.5 text-[11px] font-studio">
            <BadgeIcon className="h-3.5 w-3.5 text-studio-accent" />
            <span className="text-slate-200/50">{badge.text}</span>
          </div>
        )}
        <h1 className="mb-4 text-[32px] md:text-[40px] font-bold text-slate-100 
                       tracking-tight leading-[1.15]">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] text-slate-200/45 max-w-[600px] mx-auto leading-[1.6]">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
```

### Migration Steps
1. Create `StudioHero` in `frontend/src/shared/components/layout/studio-hero.tsx`
2. Replace all `HeroSection` usages with `StudioHero`
3. Update gradient text spans: keep `bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent`
4. Delete old `HeroSection`

---

## 5. `Section` → `StudioSection`

**File**: `frontend/src/shared/components/custom-ui/section.tsx`

### Target

```tsx
const variantClasses = {
  default: "",
  muted: "bg-white/[0.015]",
  gradient: "bg-gradient-to-b from-white/[0.02] to-transparent",
};

export function StudioSection({ children, maxWidth = "4xl", variant = "default" }: Props) {
  return (
    <section className={cn("px-6 py-10 md:py-14", variantClasses[variant])}>
      <div className={cn("mx-auto", maxWidthClasses[maxWidth])}>
        {children}
      </div>
    </section>
  );
}
```

### Changes
- Remove `container` class (uses the shell's full width with padding)
- Replace `bg-muted/30` → `bg-white/[0.015]`
- Replace `bg-gradient-to-b from-muted/50` → `bg-gradient-to-b from-white/[0.02]`
- Reduce padding: `py-16 md:py-24` → `py-10 md:py-14`

---

## 6. `FeatureCard` → `StudioFeatureCard`

**File**: `frontend/src/shared/components/custom-ui/feature-card.tsx`

### Target

```tsx
export function StudioFeatureCard({ icon: Icon, title, description, hoverable }: Props) {
  return (
    <div className={cn(
      "bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-5",
      hoverable && "transition-all hover:border-studio-accent/30 group cursor-pointer"
    )}>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center 
                      rounded-xl bg-studio-accent/15 transition-transform 
                      group-hover:scale-110">
        <Icon className="h-5 w-5 text-studio-accent" />
      </div>
      <h3 className="mb-1.5 text-[14px] font-bold text-studio-fg">{title}</h3>
      {description && (
        <p className="text-[12px] text-slate-200/45 leading-[1.6]">{description}</p>
      )}
    </div>
  );
}
```

### Changes
- Replace shadcn `Card` with dark div
- `bg-primary/10` → `bg-studio-accent/15`
- `text-primary` → `text-studio-accent`
- `border-2` → `border border-white/[0.06]`
- `text-xl font-semibold` → `text-[14px] font-bold`
- `text-sm text-muted-foreground` → `text-[12px] text-slate-200/45`

---

## 7. shadcn Component Theming

Rather than replacing every shadcn component, **override the CSS variables** in `globals.css` so all shadcn primitives automatically render dark:

### `globals.css` Changes

```css
/* Replace the :root @layer base block with dark-first values */
@layer base {
  :root {
    --background: 230 25% 4%;        /* #08080F */
    --foreground: 214 32% 91%;       /* #E2E8F0 */
    --card: 240 28% 7%;              /* #0C0C18 */
    --card-foreground: 214 32% 91%;
    --popover: 240 28% 7%;
    --popover-foreground: 214 32% 91%;
    --primary: 234 89% 74%;          /* #818CF8 */
    --primary-foreground: 0 0% 100%;
    --purple: 270 91% 75%;           /* #C084FC */
    --purple-foreground: 0 0% 100%;
    --secondary: 240 5% 12%;
    --secondary-foreground: 214 32% 91%;
    --muted: 240 5% 12%;
    --muted-foreground: 215 20% 65%;
    --accent: 240 5% 12%;
    --accent-foreground: 214 32% 91%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 0 0% 100% / 0.06;
    --input: 0 0% 100% / 0.08;
    --ring: 234 89% 74% / 0.5;
    --radius: 0.625rem;              /* 10px */
    
    --sidebar-background: 240 28% 7%;
    --sidebar-foreground: 214 32% 91%;
    --sidebar-accent: 234 89% 74% / 0.08;
    --sidebar-accent-foreground: 234 89% 74%;
    --sidebar-border: 0 0% 100% / 0.06;
    --sidebar-ring: 234 89% 74% / 0.5;
  }
}

body {
  @apply bg-studio-bg text-studio-fg font-studio antialiased;
}
```

This way, any use of `bg-card`, `text-foreground`, `border`, `bg-primary`, etc. will **automatically** render in the dark studio palette.

---

## 8. Migration Priority Order

1. **CSS tokens** (`globals.css`) — flip base variables to dark (affects everything at once)
2. **`PageLayout` → `StudioShell`** — create the new shell
3. **`StudioTopBar`** — extend for all variants
4. **`HeroSection` → `StudioHero`** — update hero sections
5. **`Section` → `StudioSection`** — update section containers  
6. **`FeatureCard` → `StudioFeatureCard`** — update cards
7. **Individual page files** — detailed in `03-page-by-page-plan.md`
8. **`FooterCustom` → `StudioFooter`** — minimal dark footer
9. **Cleanup** — remove dead components, unused light-theme utilities

---

## 9. Files to Create

| File | Purpose |
|---|---|
| `frontend/src/shared/components/layout/studio-shell.tsx` | New main layout wrapper |
| `frontend/src/shared/components/layout/studio-hero.tsx` | Dark hero section |
| `frontend/src/shared/components/layout/studio-footer.tsx` | Minimal dark footer |
| `frontend/src/shared/components/custom-ui/studio-feature-card.tsx` | Dark feature card |
| `frontend/src/shared/components/custom-ui/studio-section.tsx` | Dark section container |

## 10. Files to Delete (after migration)

| File | Reason |
|---|---|
| `frontend/src/shared/components/layout/page-layout.tsx` | Replaced by `StudioShell` |
| `frontend/src/shared/components/layout/hero-section.tsx` | Replaced by `StudioHero` |
| `frontend/src/shared/components/layout/footer-custom.tsx` | Replaced by `StudioFooter` |
| `frontend/src/shared/components/custom-ui/feature-card.tsx` | Replaced by `StudioFeatureCard` |
| `frontend/src/shared/components/layout/navbar.tsx` | Merged into extended `StudioTopBar` |
| `frontend/src/shared/components/layout/auth-layout.tsx` | Merged into `StudioShell` |
| `frontend/src/shared/components/layout/customer-layout.tsx` | Merged into `StudioShell` |
| `frontend/src/shared/components/layout/main-layout.tsx` | Merged into `StudioShell` |
