# Migration Plan: Next.js → Vite (Frontend) + Hono (Backend)

**Created:** March 2026
**Status:** Proposed
**Scope:** Replace the full-stack Next.js monolith with a split architecture

---

## Executive Summary

This plan proposes splitting the current Next.js full-stack application into two separate services:

| Layer | Current | Proposed |
|-------|---------|----------|
| **Frontend** | Next.js 16 (App Router + RSC) | **Vite + React 19 + TanStack Router** |
| **Backend** | Next.js API Routes (43 route files) | **Hono on Bun** |
| **Runtime** | Node.js / Bun (via Next.js) | **Bun** (both services) |

> [!IMPORTANT]
> The project is already 90%+ client-side React. Server components are thin wrappers that only do SEO metadata (`generateMetadata`) and i18n message loading (`getTranslations`) — no complex SSR logic.

---

## Why Leave Next.js?

### Pain Points

| Issue | Detail |
|-------|--------|
| **Tight coupling** | Frontend and API are bundled in one deploy; a UI typo fix redeploys the entire API |
| **Edge runtime limitations** | Can't use Redis, crypto, or Prisma in middleware — CSRF, rate limiting, and auth all had to move to API route handlers |
| **Build times** | Full-stack builds are slow; splitting allows parallel CI |
| **Complexity tax** | RSC/SSR mental model (server vs client boundaries, `"use client"` directives, layout hydration) adds friction for what is essentially a client-rendered SPA |
| **Deployment flexibility** | Can't independently scale frontend CDN vs backend compute |
| **Version churn** | Next.js major versions (15 → 16 in months) regularly introduce breaking changes |

### What We Lose (and Mitigations)

| Next.js Feature | Usage in Project | Mitigation |
|-----------------|-----------------|------------|
| `generateMetadata` (SSR SEO) | 28 pages | **Prerender** public pages at build time (Vite SSG plugin) or use `react-helmet-async` for client-side meta |
| `getTranslations` (server i18n) | 28 pages | Switch to `i18next` + `react-i18next` (client-side, same JSON files) |
| `next/font` (Google Fonts) | Inter, Lora | Use `@fontsource` packages or plain `<link>` tags |
| `next-intl` server provider | Root layout | Replace with `i18next` provider (client-side) |
| `next-themes` | Dark mode | Replace with a lightweight theme context (or keep `next-themes` — it works outside Next.js) |
| Middleware (CORS, security headers) | `middleware.ts` | Move to Hono middleware (more capable — no edge runtime limits) |
| `sitemap.ts` / `robots.ts` / `manifest.ts` | SEO files | Generate at build time (Vite plugin or script) |
| File-based routing | `app/` directory | TanStack Router (file-based routing option available) |
| Image optimization | `next/image` | Use Cloudflare Image Resizing or `<img>` with srcset |

---

## Recommended Stack

### Frontend: Vite + React 19 + TanStack Router

| Choice | Why |
|--------|-----|
| **Vite** | Fastest dev server (HMR in <50ms), Bun-native, simple config, massive plugin ecosystem |
| **React 19** | Zero migration — all 107+ existing client components, hooks, and Radix UI primitives work unchanged |
| **TanStack Router** | Type-safe file-based routing, built-in data loading, works perfectly with TanStack Query (already in use), better DX than React Router |
| **TanStack Query** | Already in use — no change needed |
| **Tailwind CSS 4** | Already in use — works natively with Vite |
| **Radix UI** | Already in use — framework-agnostic, zero changes |
| **React Hook Form + Zod** | Already in use — framework-agnostic |
| **Framer Motion** | Already in use — framework-agnostic |
| **i18next** | Replaces `next-intl` — same JSON translation files, more flexible, works client-side |

**What carries over unchanged:** All component files, hooks, contexts, constants, types, validation schemas, utility functions, Tailwind styles. Essentially the entire `features/` and `shared/` directories.

### Backend: Hono on Bun

| Choice | Why |
|--------|-----|
| **Hono** | Ultra-lightweight (14KB), TypeScript-first, middleware pattern very similar to existing `withApiProtection` wrappers, Bun-native, Web Standard APIs |
| **Bun** | Already the project's package manager and runtime — native performance, built-in test runner |
| **Prisma** | Already in use — no change, same schema, same client |
| **Firebase Admin SDK** | Already in use — no change |
| **Stripe SDK** | Already in use — no change |
| **ioredis** | Already in use — no change |
| **Zod** | Already in use — same validation schemas for request bodies |

**Why Hono over alternatives:**

| Option | Verdict |
|--------|---------|
| **Express** | Mature but old; callback-based, no native TypeScript, slower |
| **Fastify** | Good, but heavier than needed; plugin system adds complexity |
| **NestJS** | Excellent for enterprise, but massive framework overhead for 43 routes that already have clean structure |
| **Elysia** | Bun-native like Hono, but less mature ecosystem and documentation |
| **Hono** ✅ | Lightest option, Web Standards API, middleware maps 1:1 to existing patterns, huge community, runs on Bun/Node/Deno/Cloudflare Workers |

---

## Architecture After Migration

```
┌─────────────────────────────────────────────┐
│              Frontend (Vite + React)         │
│         Deployed as static SPA on CDN       │
│                                             │
│  ┌────────────┐ ┌───────────┐ ┌──────────┐ │
│  │ Public     │ │ Customer  │ │ Admin    │ │
│  │ Pages      │ │ App       │ │ Panel    │ │
│  └────────────┘ └───────────┘ └──────────┘ │
│                                             │
│  React 19 · TanStack Router · TanStack Query│
│  Radix UI · Tailwind CSS · Firebase SDK     │
└──────────────────────┬──────────────────────┘
                       │ HTTPS (JSON API)
                       ▼
┌─────────────────────────────────────────────┐
│              Backend (Hono on Bun)           │
│        Deployed as containerized service    │
│                                             │
│  Middleware: CORS · Rate Limit · CSRF ·     │
│  Auth · Security Headers · Logging          │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Customer │ │ Admin    │ │ Public     │ │
│  │ Routes   │ │ Routes   │ │ Routes     │ │
│  └──────────┘ └──────────┘ └────────────┘ │
│                                             │
│  Prisma · Firebase Admin · Stripe ·         │
│  Redis · Resend · Zod                       │
└──────────────────────┬──────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │PostgreSQL│  │ Firestore│  │  Stripe  │
   │ (Prisma) │  │(Firebase)│  │ Payments │
   └──────────┘  └──────────┘  └──────────┘
```

### Key Benefits of the Split

1. **Frontend deploys to CDN** — instant global edge delivery, no server needed for UI
2. **Backend scales independently** — can add replicas without redeploying UI
3. **Parallel CI** — frontend builds in ~10s (Vite), backend builds separately
4. **No more edge runtime limitations** — full Node.js/Bun APIs available in all middleware
5. **Simpler mental model** — no server/client component boundary confusion

---

## Repository Structure (Proposed)

```
WebsiteTemplate2/
├── README.md
├── docs/                            # Unchanged
│
├── frontend/                        # ← was: project/app + project/features + project/shared
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html                   # SPA entry point
│   ├── public/                      # Static assets (from project/public)
│   ├── src/
│   │   ├── main.tsx                 # React entry (providers, router)
│   │   ├── router.tsx               # TanStack Router config
│   │   ├── routes/                  # File-based routes (maps to app/ pages)
│   │   │   ├── __root.tsx           # Root layout
│   │   │   ├── index.tsx            # Landing page
│   │   │   ├── pricing.tsx
│   │   │   ├── faq.tsx
│   │   │   ├── _auth/              # Auth-guarded routes
│   │   │   │   ├── calculator.tsx
│   │   │   │   ├── account.tsx
│   │   │   │   └── checkout.tsx
│   │   │   └── admin/              # Admin routes
│   │   │       ├── dashboard.tsx
│   │   │       └── customers.tsx
│   │   │
│   │   ├── features/               # ← Direct copy from project/features
│   │   │   ├── account/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── calculator/
│   │   │   ├── contact/
│   │   │   ├── faq/
│   │   │   ├── payments/
│   │   │   └── subscriptions/
│   │   │
│   │   ├── shared/                 # ← Direct copy from project/shared (minus server-only code)
│   │   │   ├── components/
│   │   │   ├── constants/
│   │   │   ├── contexts/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── providers/
│   │   │   ├── types/
│   │   │   └── utils/              # Client-safe utilities only
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── translations/
│   │       └── en.json              # ← Direct copy
│   │
│   └── __tests__/                   # Frontend tests
│
├── backend/                         # ← was: project/app/api + server-only services
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.ts                 # Hono app entry
│   │   ├── middleware/              # ← from project/shared/middleware + middleware.ts
│   │   │   ├── cors.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── csrf.ts
│   │   │   ├── auth.ts             # Firebase token verification
│   │   │   └── security-headers.ts
│   │   │
│   │   ├── routes/                  # ← from project/app/api
│   │   │   ├── customer/
│   │   │   │   ├── orders.ts
│   │   │   │   └── profile.ts
│   │   │   ├── admin/
│   │   │   │   ├── customers.ts
│   │   │   │   ├── orders.ts
│   │   │   │   └── subscriptions.ts
│   │   │   ├── calculator/
│   │   │   │   ├── calculate.ts
│   │   │   │   ├── history.ts
│   │   │   │   └── usage.ts
│   │   │   ├── subscriptions/
│   │   │   ├── auth/
│   │   │   ├── health/
│   │   │   └── public/
│   │   │
│   │   ├── services/               # ← from project/shared/services (server-only)
│   │   │   ├── db/                 # Prisma client
│   │   │   ├── firebase/           # Firebase Admin SDK
│   │   │   ├── email/              # Resend
│   │   │   ├── rate-limit/         # Redis rate limiter
│   │   │   ├── storage/            # R2/S3
│   │   │   ├── csrf/               # CSRF tokens
│   │   │   └── session/            # Session management
│   │   │
│   │   ├── utils/                  # ← from project/shared/utils (server-only)
│   │   │   ├── config/envUtil.ts
│   │   │   ├── error-handling/
│   │   │   ├── security/
│   │   │   └── validation/
│   │   │
│   │   └── infrastructure/         # ← from project/infrastructure
│   │       └── database/prisma/
│   │
│   └── __tests__/                   # Backend tests
│
└── docker-compose.yml               # PostgreSQL + Redis for local dev
```

---

## File Migration Map

### What Moves Where

| Current Location | Destination | Notes |
|-----------------|-------------|-------|
| `project/app/(public)/**/*.tsx` | `frontend/src/routes/` | Page components become route files; remove `generateMetadata` (use helmet) |
| `project/app/(customer)/**/*.tsx` | `frontend/src/routes/_auth/` | Guarded routes |
| `project/app/admin/**/*.tsx` | `frontend/src/routes/admin/` | Admin routes |
| `project/app/api/**/*.ts` | `backend/src/routes/` | Convert from Next.js route handlers to Hono handlers |
| `project/features/**` | `frontend/src/features/` | **Copy unchanged** — all client-side |
| `project/shared/components/**` | `frontend/src/shared/components/` | **Copy unchanged** — all client-side |
| `project/shared/constants/**` | `frontend/src/shared/constants/` | **Copy unchanged** |
| `project/shared/contexts/**` | `frontend/src/shared/contexts/` | **Copy unchanged** |
| `project/shared/hooks/**` | `frontend/src/shared/hooks/` | **Copy unchanged** |
| `project/shared/lib/**` | `frontend/src/shared/lib/` | **Copy unchanged** |
| `project/shared/providers/**` | `frontend/src/shared/providers/` | Remove `NextIntlClientProvider`, add `i18nextProvider` |
| `project/shared/types/**` | Shared package or duplicated | Types used by both sides |
| `project/shared/services/api/**` | `frontend/src/shared/services/api/` | Client-side fetch utils |
| `project/shared/services/firebase/` (client) | `frontend/src/shared/services/firebase/` | Firebase client SDK |
| `project/shared/services/firebase/` (admin) | `backend/src/services/firebase/` | Firebase Admin SDK |
| `project/shared/services/seo/**` | `frontend/src/shared/services/seo/` | Convert to react-helmet-async |
| `project/shared/services/db/**` | `backend/src/services/db/` | Prisma client |
| `project/shared/services/email/**` | `backend/src/services/email/` | Resend |
| `project/shared/services/rate-limit/**` | `backend/src/middleware/` | Redis rate limiter |
| `project/shared/services/csrf/**` | `backend/src/middleware/` | CSRF tokens |
| `project/shared/services/storage/**` | `backend/src/services/storage/` | R2/S3 |
| `project/shared/middleware/**` | `backend/src/middleware/` | API protection → Hono middleware |
| `project/shared/utils/config/**` | `backend/src/utils/config/` | Server env vars |
| `project/shared/utils/permissions/**` | Both (shared) | Used by both frontend and backend |
| `project/shared/utils/validation/**` | Both (shared) | Zod schemas used by both |
| `project/translations/**` | `frontend/src/translations/` | **Copy unchanged** |
| `project/infrastructure/**` | `backend/src/infrastructure/` | Prisma schema + migrations |
| `project/public/**` | `frontend/public/` | **Copy unchanged** |
| `project/middleware.ts` | `backend/src/middleware/` | CORS + security headers → Hono middleware |

---

## API Route Conversion Pattern

### Before (Next.js Route Handler)

```typescript
// project/app/api/customer/orders/route.ts
import { NextRequest, NextResponse } from "next/server";

async function getHandler(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  // ... handler logic
  return NextResponse.json(data);
}

export const GET = withUserProtection(getHandler, {
  rateLimitType: "customer",
});
```

### After (Hono Handler)

```typescript
// backend/src/routes/customer/orders.ts
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rate-limit";

const orders = new Hono();

orders.get("/", authMiddleware("user"), rateLimiter("customer"), async (c) => {
  const user = c.get("user"); // Set by authMiddleware
  // ... same handler logic
  return c.json(data);
});

export default orders;
```

The conversion is mechanical — the `withApiProtection` wrapper maps directly to Hono middleware chains. The handler body logic stays nearly identical.

---

## Phased Approach

### Phase 1: Backend Extraction (~1 week)
> Lowest risk — frontend still runs on Next.js during this phase

1. **Initialize Hono project** in `backend/`
2. **Copy server-only code**: services, middleware, utils, infrastructure
3. **Convert 43 API route files** to Hono handlers (mechanical transformation)
4. **Set up Hono middleware** chain: CORS → rate limit → CSRF → auth → security headers
5. **Test all API endpoints** with existing test suite (adapt Supertest calls)
6. **Point Next.js frontend** API calls to the new Hono backend URL (env var change)
7. **Deploy backend** separately on Railway; verify everything works with Next.js frontend

### Phase 2: Frontend Extraction (~1–2 weeks)
> Backend is stable; focus on UI migration

1. **Initialize Vite + React project** in `frontend/`
2. **Copy client code**: features/, shared/components, shared/hooks, shared/contexts, shared/constants, translations
3. **Set up TanStack Router** with file-based routes
4. **Convert 28 page files** from Next.js pages to route components:
   - Remove `generateMetadata` → add `react-helmet-async` for SEO meta tags
   - Remove `getTranslations` → use `i18next` `useTranslation` hook
   - Remove `"use client"` directives (not needed in Vite)
5. **Replace `next-intl`** with `i18next` + `react-i18next` (same JSON files)
6. **Replace `next/font`** with `@fontsource/inter` + `@fontsource/lora`
7. **Replace `next/image`** with standard `<img>` + Cloudflare Image Resizing (or `sharp`)
8. **Replace `next-themes`** with a simple theme context (or keep — it supports non-Next)
9. **Generate SEO files** at build time: `sitemap.xml`, `robots.txt`, `manifest.json` via Vite plugins
10. **Test UI** end-to-end against the Hono backend

### Phase 3: Cleanup & Optimization (~3 days)
1. **Remove `project/` directory** (old Next.js monolith)
2. **Set up monorepo** tooling (Turborepo or Bun workspaces) for shared types/validation
3. **Configure CI/CD** — parallel frontend + backend builds and deploys
4. **Update docs** — new architecture diagrams, setup instructions, contributing guide
5. **Deploy frontend** to Cloudflare Pages / Vercel Edge / S3+CloudFront as static SPA
6. **Performance baseline** — verify Lighthouse scores, bundle size, API latencies

---

## Shared Code Strategy

Code used by **both** frontend and backend (types, Zod schemas, constants, permissions):

**Option A — Monorepo package** (recommended):
```
packages/
  shared/
    ├── types/          # TypeScript interfaces
    ├── validation/     # Zod schemas
    ├── constants/      # App constants, subscription tiers
    └── permissions/    # Feature access logic
```

**Option B — Duplicate** (simpler, acceptable for small shared surface):
Copy the ~5–10 shared files into both `frontend/` and `backend/`. Acceptable if the shared surface is small and rarely changes.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SEO regression (public pages) | Medium | High | Use Vite SSG plugin for static prerendering of public pages; or add a prerender step |
| API conversion bugs | Low | Medium | Existing test suite (652 unit + 180 integration) catches regressions |
| i18n migration issues | Low | Low | Same JSON translation files; just different runtime library |
| Firebase Auth flow breaks | Low | High | Firebase client SDK is framework-agnostic; auth hooks stay the same |
| Deployment complexity increase | Medium | Medium | Docker Compose for local; Railway deploys both services from one repo |
| Longer initial setup for new devs | Low | Low | `bun install` in both dirs; or monorepo single install |

---

## Timeline Estimate

| Phase | Duration | Can Start After |
|-------|----------|----------------|
| Phase 1: Backend extraction | 5–7 days | Immediately |
| Phase 2: Frontend extraction | 7–10 days | Phase 1 complete |
| Phase 3: Cleanup & deploy | 2–3 days | Phase 2 complete |
| **Total** | **~3 weeks** | |

---

## Dependencies to Drop

| Package | Why | Replacement |
|---------|-----|-------------|
| `next` | The whole point | — |
| `next-intl` | Next.js-specific i18n | `i18next` + `react-i18next` |
| `next-themes` | Optional (works outside Next too) | Keep or use simple context |
| `next-rate-limit` | Next.js rate limiting | Hono middleware + ioredis (already have) |
| `eslint-config-next` | Next.js ESLint rules | `@eslint/js` + `typescript-eslint` |
| `@next/bundle-analyzer` | Next.js build analysis | `rollup-plugin-visualizer` (Vite) |

## Dependencies to Add

| Package | Purpose | Where |
|---------|---------|-------|
| `vite` | Build tool | Frontend |
| `@tanstack/react-router` | File-based routing | Frontend |
| `react-helmet-async` | SEO meta tags | Frontend |
| `i18next` + `react-i18next` | i18n | Frontend |
| `@fontsource/inter` + `@fontsource/lora` | Fonts | Frontend |
| `hono` | HTTP framework | Backend |
| `vite-plugin-sitemap` | Sitemap generation | Frontend (build) |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| **Hono over NestJS** | 43 routes with existing clean structure don't need NestJS's heavy DI/module system. Hono's middleware chaining maps 1:1 to the existing `withApiProtection` pattern. |
| **Vite over Remix/React Router v7** | Remix still has server-rendering opinions; Vite + TanStack Router gives a clean SPA with no SSR baggage. |
| **TanStack Router over React Router** | Already using TanStack Query; same ecosystem, type-safe routing, better DX. |
| **i18next over FormatJS** | Largest ecosystem, supports same JSON format, most similar API to `next-intl`'s `useTranslations`. |
| **Static SPA over SSG/SSR** | Public pages (marketing, pricing, FAQ) are mostly static content with client-side interactivity. SEO can be handled by prerendering at build time. No user-specific SSR is needed. |

---

*This plan is a living document. Update as decisions are refined during implementation.*
