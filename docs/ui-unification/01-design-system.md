# Design System Specification — Studio Dark Theme

This document defines the **complete design system** that must be applied consistently across the entire codebase, based on the `/studio/discover` reference implementation.

---

## 1. Color Palette

### Core Tokens (CSS Custom Properties in `globals.css`)

```css
:root {
  /* ── Background layers (darkest → lightest surface) ── */
  --studio-bg:       #08080F;    /* Page/app background */
  --studio-surface:  #0C0C18;    /* Panels, sidebars, cards */
  --studio-topbar:   #0E0E1A;    /* Top navigation bar */

  /* ── Accent colors ── */
  --studio-accent:   #818CF8;    /* Primary accent (indigo-400) */
  --studio-purple:   #C084FC;    /* Secondary accent (purple-400) */

  /* ── Text colors ── */
  --studio-fg:       #E2E8F0;    /* Primary text (slate-200) */
  --studio-fg-dim:   rgba(226,232,240,0.4);  /* Dimmed text */

  /* ── Borders & focus ── */
  --studio-border:   rgba(255,255,255,0.06);  /* Default border */
  --studio-ring:     rgba(129,140,248,0.5);   /* Focus ring */
}
```

### Text Opacity Scale (use `text-slate-200/XX`)

| Purpose | Class | Opacity |
|---|---|---|
| Primary text | `text-studio-fg` | 100% |
| Secondary text / body | `text-slate-200/55` | 55% |
| Tertiary / labels | `text-slate-200/40` | 40% |
| Muted / section headers | `text-slate-200/35` | 35% |
| Dimmed / disabled | `text-slate-200/25` | 25% |
| Ghost / placeholder | `text-slate-200/20` | 20% |

### Border Opacity Scale

| Purpose | Class |
|---|---|
| Default separator | `border-white/[0.05]` or `border-white/[0.06]` |
| Subtle card border | `border-white/[0.08]` |
| Hover border | `border-white/10` |
| Active/accent border | `border-studio-accent/30` |
| Dashed action border | `border-dashed border-studio-accent/25` |

### Background Opacity Scale

| Purpose | Class |
|---|---|
| Card / panel surface | `bg-white/[0.03]` or `bg-white/[0.04]` |
| Input background | `bg-white/[0.05]` |
| Skeleton / ghost | `bg-white/[0.06]` |
| Hover state | `bg-white/[0.08]` |
| Active state | `bg-studio-accent/[0.08]` |
| Tag / badge bg | `bg-studio-accent/15` |

### Gradient Definitions

```
Primary Action:    bg-gradient-to-br from-studio-accent to-studio-purple
Page Hero:         bg-gradient-to-br from-[#1A1A2E] to-[#16213E]
Subtle Accent:     bg-studio-accent/[0.06]
Card Glow:         0 0 60px rgba(129,140,248,0.10)
```

### Status Colors

```
Draft:      bg-white/[0.06]      text-slate-200/40
Queued:     bg-amber-400/15      text-amber-400
Scheduled:  bg-blue-400/15       text-blue-400  
Posted:     bg-green-400/15      text-green-400
Failed:     bg-red-400/15        text-red-400
Error:      text-red-400
```

---

## 2. Typography

### Font Stack

```css
--font-studio:      "Plus Jakarta Sans", system-ui, sans-serif;
--font-studio-mono:  "Fira Code", "JetBrains Mono", ui-monospace, monospace;
```

> **Important**: Replace all uses of `font-sans` (Inter) with `font-studio` (Plus Jakarta Sans).

### Type Scale

Use **arbitrary pixel values** (`text-[Xpx]`), not Tailwind preset classes:

| Use | Size | Weight | Additional |
|---|---|---|---|
| Section header (uppercase) | `text-[10px]` | `font-semibold` | `tracking-[1.5px] uppercase text-slate-200/25` |
| Small label / caption | `text-[10px]` | `font-semibold` | `tracking-[1px]` |
| Body / list item | `text-[11px]`–`text-[12px]` | `font-medium` | — |
| Card title / subtitle | `text-[12px]`–`text-[13px]` | `font-semibold` | `text-studio-fg` |
| Page heading | `text-[18px]`–`text-[20px]` | `font-bold` | `text-slate-100` |
| Hero heading | `text-[28px]`–`text-[36px]` | `font-bold` | gradient text clip |
| Metric number | `text-[16px]`–`text-[18px]` | `font-bold` | `font-studio-mono` |
| Status badge | `text-[9px]` | `font-bold` | `uppercase tracking-[0.5px]` |
| Toolbar button | `text-[11px]` | `font-medium` | — |
| Tab | `text-[11px]`–`text-[13px]` | `font-medium` | — |

---

## 3. Layout Patterns

### App Shell (replace `PageLayout`)

```tsx
<div className="h-screen bg-studio-bg text-studio-fg font-studio 
                grid grid-rows-[48px_1fr] overflow-hidden">
  <StudioTopBar ... />
  <main className="overflow-y-auto">
    {/* Page content */}
  </main>
</div>
```

### Three-Column Panel Layout (studio pages)

```tsx
<div className="grid overflow-hidden" 
     style={{ gridTemplateColumns: "220px 1fr 300px" }}>
  <aside className="bg-studio-surface border-r border-white/[0.05]">
    {/* Left sidebar */}
  </aside>
  <main className="bg-studio-bg overflow-y-auto">
    {/* Center content */}
  </main>
  <aside className="bg-studio-surface border-l border-white/[0.05]">
    {/* Right panel */}
  </aside>
</div>
```

### Single-Column Content Layout (for public/marketing pages)

```tsx
<div className="h-screen bg-studio-bg text-studio-fg font-studio 
                grid grid-rows-[48px_1fr] overflow-hidden">
  <StudioTopBar ... />
  <main className="overflow-y-auto">
    <div className="max-w-[800px] mx-auto px-6 py-8">
      {/* Content */}
    </div>
  </main>
</div>
```

---

## 4. Component Patterns

### Dark Card

```tsx
<div className="bg-white/[0.03] border border-white/[0.06] 
                rounded-[10px] p-4 transition-colors 
                hover:border-white/10">
  {/* Content */}
</div>
```

### Dark Feature Card (with icon)

```tsx
<div className="bg-white/[0.03] border border-white/[0.06] 
                rounded-[14px] p-5 transition-all 
                hover:border-studio-accent/30 group">
  <div className="w-10 h-10 rounded-xl bg-studio-accent/15 
                  flex items-center justify-center mb-3
                  transition-transform group-hover:scale-110">
    <Icon className="h-5 w-5 text-studio-accent" />
  </div>
  <h3 className="text-[14px] font-bold text-studio-fg mb-1.5">
    {title}
  </h3>
  <p className="text-[12px] text-slate-200/45 leading-[1.6]">
    {description}
  </p>
</div>
```

### Dark Input

```tsx
<input className="w-full bg-white/[0.05] border border-white/[0.08] 
                  rounded-lg text-studio-fg text-[12px] px-3 py-2 
                  outline-none font-studio 
                  placeholder:text-slate-200/20 
                  transition-colors duration-200 
                  focus:border-studio-ring/50" />
```

### Primary Gradient Button

```tsx
<button className="bg-gradient-to-br from-studio-accent to-studio-purple 
                   text-white text-[12px] font-semibold px-4 py-2 
                   rounded-lg border-0 cursor-pointer 
                   transition-opacity hover:opacity-85 font-studio">
  ✦ Label
</button>
```

### Ghost/Secondary Button

```tsx
<button className="bg-white/[0.05] border border-white/[0.07] 
                   text-slate-200/50 text-[11px] font-medium 
                   px-3 py-1.5 rounded-lg 
                   hover:bg-white/[0.08] hover:text-studio-fg 
                   transition-all font-studio cursor-pointer">
  Label
</button>
```

### Filter Pills

```tsx
<button className={cn(
  "text-[11px] font-medium px-3 py-1.5 rounded-full border 
   cursor-pointer font-studio transition-all duration-150",
  isActive
    ? "bg-studio-accent/15 text-studio-accent border-studio-accent/30"
    : "bg-white/[0.03] text-slate-200/40 border-white/[0.08] hover:text-slate-200/70"
)}>
```

### Section Label (uppercase)

```tsx
<p className="text-[10px] font-semibold tracking-[1.5px] uppercase 
              text-slate-200/25">
  Section Title
</p>
```

### Tab Navigation

```tsx
<button className={cn(
  "h-full px-4 flex items-center gap-1.5 text-[13px] font-medium",
  "bg-transparent border-0 border-b-2 cursor-pointer font-studio",
  isActive
    ? "text-studio-accent border-b-studio-accent"
    : "text-slate-200/40 border-b-transparent hover:text-slate-200/70"
)}>
```

### Status Badge

```tsx
<span className={cn(
  "text-[9px] font-bold px-1.5 py-px rounded-full 
   uppercase tracking-[0.5px]",
  STATUS_STYLES[status]
)}>
```

### Loading Skeleton

```tsx
<div className="studio-skeleton h-[54px]" />
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <span className="text-[40px] opacity-50">🎬</span>
  <p className="text-[14px] font-semibold text-slate-200/50">{title}</p>
  <p className="text-[12px] text-slate-200/25">{subtitle}</p>
</div>
```

---

## 5. Animations & Effects

### Shimmer Skeleton

Already defined in `globals.css` as `.studio-skeleton`.

### Generation Progress Bar

Already defined as `.studio-gen-bar`.

### Phone Shadow / Glow

Already defined as `.studio-phone-shadow`.

### Transitions to apply consistently

```
transition-colors duration-150    — for hover color changes
transition-all duration-150       — for multi-property hover
transition-opacity duration-150   — for opacity hover
transition-transform              — for scale effects
```

---

## 6. Scrollbar Behavior

Hide all scrollbars in the studio shell:

```
[scrollbar-width:none] [&::-webkit-scrollbar]:hidden
```

---

## 7. What NOT to Use

After migration, these should be **removed or unused**:

| Remove | Replace With |
|---|---|
| `bg-background` | `bg-studio-bg` |
| `text-foreground` | `text-studio-fg` |
| `text-muted-foreground` | `text-slate-200/40` or similar |
| `bg-muted/30` | `bg-white/[0.03]` |
| `border-2` (thick borders) | `border border-white/[0.06]` |
| `font-sans` | `font-studio` |
| `shadow-lg`, `shadow-sm` | Studio glow effects or none |
| `hover:scale-105` | `hover:opacity-85` or subtle bg change |
| `rounded-xl`, `rounded-2xl` | `rounded-[10px]`, `rounded-[14px]` |
| `text-primary` | `text-studio-accent` |
| `bg-primary/10` | `bg-studio-accent/15` |
| Tailwind preset type sizes (`text-xl`, `text-3xl`) | Arbitrary pixel sizes (`text-[14px]`, `text-[24px]`) |
