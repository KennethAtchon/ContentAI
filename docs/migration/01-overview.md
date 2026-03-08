# 01 — Overview: What We're Migrating

## Current State

The codebase is a general-purpose SaaS template with:
- Auth (sign-in / sign-up via Firebase)
- Subscriptions and payments (Stripe)
- Admin dashboard
- Customer account management
- Placeholder features: calculator, FAQ, contact, orders

These features exist as scaffolding. Most of them are **not relevant** to the new platform and will be removed or repurposed.

---

## Target State

A **Viral Reel Studio** — an AI-powered workspace for discovering, analyzing, and remixing viral Instagram Reels. Based on `project.md` and the `AIStudioDesign.jsx` reference UI.

### What the product does

1. **Discover** — Search a niche (e.g. "personal finance") and surface top-performing Reels from the last 7–14 days with key metrics (views, engagement rate, likes, comments).
2. **Analyze** — AI breaks down each Reel's structure: hook pattern, emotional trigger, format, caption framework, CTA type, audio.
3. **Generate** — AI produces remix variations: new hooks, captions, and scripts adapted from viral structures, without copying.
4. **Queue** — Schedule generated content for posting to Instagram pages.
5. **Feedback Loop** — Track posted content performance; refine the viral formula over time.

---

## UI Reference

The target interface is `AIStudioDesign.jsx`:

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR: Logo | Discover / Generate / Edit / Queue | Search     │
├──────────────┬────────────────────────────┬─────────────────────┤
│  SIDEBAR     │  CANVAS (phone preview)    │  AI PANEL           │
│              │                            │                      │
│  Source      │  • Floating stat cards     │  Tabs: Analysis /   │
│  Reels list  │  • Phone mockup of Reel    │  Generate / History  │
│              │  • Toolbar: Prev/Next/     │                      │
│  AI Tools    │    Trim/Audio/Caption/     │  Metrics grid        │
│  shortcuts   │    Generate Remix          │  Hook display        │
│              │                            │  Caption preview     │
│              │                            │  Audio row           │
│              │                            │  Remix suggestion    │
│              │                            │  ──────────────────  │
│              │                            │  AI Generate input   │
└──────────────┴────────────────────────────┴─────────────────────┘
```

Design tokens from the reference:
- Background: `#08080F`
- Surface: `#0C0C18` / `#0E0E1A`
- Accent: indigo `#818CF8` + purple `#C084FC` gradient
- Font: `Plus Jakarta Sans` (UI) + `Fira Code` (data/mono)
- Borders: `rgba(255,255,255,0.05–0.08)`

---

## What Stays

| Component | Keep? | Notes |
|---|---|---|
| Firebase Auth | Yes | Users still sign in to access the studio |
| Stripe subscriptions | Yes (simplified) | Subscription gates access; remove complex billing UI |
| Hono backend | Yes | Add new routes for reels, analysis, generation |
| Drizzle + PostgreSQL | Yes | New schema tables added |
| Redis | Yes | Rate limiting for AI calls; job queue |
| TanStack Router | Yes | Restructure routes around studio tabs |
| TanStack Query | Yes | Data fetching for reels and analysis |
| Tailwind CSS v4 | Yes | Plus the ais-* CSS from the design |
| react-i18next | Yes | All new strings go through translation keys |

## What Gets Removed

| Component | Remove? | Replaced By |
|---|---|---|
| `features/calculator` | Yes | Not needed |
| `features/contact` | Yes | Not needed |
| `features/faq` | Yes | Not needed |
| `features/customers` | Yes | Replaced by user/studio concept |
| `features/orders` | Yes | Not needed |
| Routes: `/calculator`, `/contact`, `/faq` | Yes | — |
| Generic landing page | Yes | Replaced by studio landing |

---

## Platform Phases vs. Implementation Steps

`project.md` defines 6 platform phases. Each maps to implementation steps in this repo:

| Platform Phase | Implementation Step |
|---|---|
| Phase 1: MVP Data Output | Steps 02 (UI) + 03 (Data layer with mock/real data) |
| Phase 2: Data Collection | Step 03 (scraper integration via backend jobs) |
| Phase 3: AI Analysis | Step 04 (AI analysis pipeline) |
| Phase 4: Content Creation | Step 05 (generation engine) |
| Phase 5: Feedback Loop | Step 06 (queue + analytics tracking) |
| Phase 6: Scaling | Future — multi-page, multi-niche |
