# UI Unification Plan — Executive Summary

## Problem Statement

The ContentAI (ReelStudio) codebase currently has **two entirely different UI design systems** that create an inconsistent, jarring user experience:

| Aspect | Studio Pages (`/studio/*`) | All Other Pages |
|---|---|---|
| **Theme** | Dark app shell (`#08080F` bg) | Light SaaS (`white` bg, gradient to muted) |
| **Font** | `Plus Jakarta Sans` (`font-studio`) | `Inter` / system (`font-sans`) |
| **Colors** | `studio-accent` indigo `#818CF8`, `studio-purple` `#C084FC` | shadcn `primary` blue, generic purples/blues |
| **Navigation** | Fixed `StudioTopBar` (48px, dark) | Sticky light `NavBar` + `FooterCustom` |
| **Cards** | `bg-white/[0.04]`, `border-white/[0.06]`, `rounded-[10px]` | shadcn `Card` with `border-2`, light bg |
| **Buttons** | Gradient `from-studio-accent to-studio-purple`, custom sizing | shadcn `Button` variants, standard sizing |
| **Layout** | Full-screen, no scroll on shell, grid columns | `container` max-width, vertical scroll |
| **Text muting** | `text-slate-200/XX` opacity values | `text-muted-foreground` HSL token |
| **Skeletons** | Custom shimmer (`studio-skeleton`) | None / Loader2 spinner |
| **Typography** | `text-[Xpx]` arbitrary pixel sizes | Tailwind preset sizes (`text-xl`, `text-3xl`) |

### Target: The `/studio/discover` Style

The `/studio/discover` page represents the **correct, target UI**. It features:

- **Deep-dark background** (`#08080F`) with subtle surface layering (`#0C0C18`)
- **Indigo–purple gradient accent** for primary actions
- **Plus Jakarta Sans** as the display/UI font, **Fira Code** for mono
- **Ultra-thin borders** at `rgba(255,255,255,0.05-0.08)`
- **Compact, dense typography** with `text-[10px]`–`text-[14px]` pixel sizes
- **Full-screen app shell** layout with grid-based panels
- **Top bar navigation** (not a traditional SaaS navbar)
- **Shimmer loading skeletons** instead of spinners
- **No footer** — it's an app, not a marketing site

### Pages That Need Fixing

All pages outside `/studio/*` need to be converted to the studio dark theme:

| Route Group | Files | Current Style |
|---|---|---|
| `/` (Home) | `index.tsx` | Light SaaS hero + features grid |
| `/(auth)/*` | `sign-in.tsx`, `sign-up.tsx` | Light cards on gradient bg |
| `/(public)/*` | 11 files (about, features, pricing, faq, contact, terms, privacy, etc.) | Light SaaS with `PageLayout` + `HeroSection` |
| `/(customer)/*` | `account.tsx`, checkout pages | Light SaaS with `PageLayout` + tabs |
| `/admin/*` | 7 files (dashboard, settings, developer, etc.) | `DashboardLayout` with light cards |
| Root | `__root.tsx` (404 page) | Light `PageLayout` |

### Shared Components That Need Refactoring

| Component | Current | Target |
|---|---|---|
| `PageLayout` | Light bg + NavBar + Footer | Dark studio shell |
| `NavBar` | Light sticky header | Replaced by `StudioTopBar` variant |
| `FooterCustom` | Full marketing footer | Minimal dark footer or removed |
| `HeroSection` | Light gradient hero | Dark gradient hero with studio tokens |
| `Section` | Light `container` sections | Dark-themed sections |
| `FeatureCard` | shadcn Card, light bg | Dark glass card with studio tokens |
| shadcn `Button` | Standard variants | Studio-themed gradient/ghost variants |
| shadcn `Card` | White bg, `border-2` | Dark glass `bg-white/[0.04]` |
| shadcn `Input` | Light input | Dark input with `bg-white/[0.05]` |

## Goals

1. **Visual consistency** — Every page in the app should feel like it belongs to the same product
2. **Premium dark aesthetic** — The deep-dark studio look is the brand identity
3. **Preserve functionality** — No logic/data changes, only visual updates
4. **Maintainability** — Consolidate into a single design system, eliminate dual-theme debt

## Scope

This plan covers:
- ✅ All 25+ route files across 5 route groups
- ✅ 10+ shared layout/UI components
- ✅ CSS design tokens (`globals.css`)
- ✅ Tailwind config (`tailwind.config.ts`)
- ✅ Asset generation (logo, icons, backgrounds)
- ❌ Backend changes (none needed)
- ❌ Business logic changes (none needed)
- ❌ New features (out of scope)
