# Code Structure & Organization

## Overview

The project is split into two independent servers. Code is organized by feature within each server, with a clear separation between business logic (features), reusable utilities (shared), and routing/presentation (routes).

**Principles:**
- Feature modules own their own components, hooks, services, and types
- Shared code is only for things used across multiple features
- Routes are thin — they call into features and services, they don't contain business logic
- No cross-feature imports; features communicate through shared services or the API

---

## Frontend structure (`frontend/src/`)

```
frontend/src/
│
├── routes/                    # File-based routing (TanStack Router)
│   ├── (public)/              # Public pages — no auth required
│   │   ├── index.tsx          # Landing page (/)
│   │   ├── pricing/
│   │   ├── faq/
│   │   ├── contact/
│   │   ├── about/
│   │   ├── features/
│   │   ├── terms/
│   │   ├── privacy/
│   │   └── ...
│   ├── (auth)/                # Sign-in, sign-up
│   ├── (customer)/            # Authenticated pages
│   │   ├── account/           # Profile, usage dashboard
│   │   ├── checkout/
│   │   └── payment/
│   ├── studio/               # ReelStudio workspace
│   │   ├── discover.tsx      # 3-panel reel discovery
│   │   ├── generate.tsx      # Full-screen generation
│   │   └── queue.tsx         # Queue management
│   └── admin/                 # Admin dashboard (admin role required)
│       ├── customers/
│       ├── orders/
│       ├── subscriptions/
│       ├── niches/
│       └── ...
│
├── features/                  # Feature modules — domain business logic
│   ├── account/               # Usage dashboard, profile editor, subscription management
│   ├── admin/                 # Admin components: tables, modals, stats
│   ├── auth/                  # Auth guard, user button, useAuthenticatedFetch
│   ├── reels/                 # Reel discovery (ReelList, PhonePreview, AnalysisPanel)
│   │   ├── components/
│   │   ├── hooks/             # use-reels.ts, use-reel-analysis.ts
│   │   └── services/
│   ├── generation/            # AI content generation
│   │   ├── hooks/             # use-generate-content.ts, use-generation-history.ts
│   │   └── services/
│   ├── studio/                # Studio workspace shell (StudioTopBar, layout)
│   │   └── components/
│   ├── payments/              # Stripe checkout, payment success/cancel
│   └── subscriptions/         # Feature gating, FeatureGate, upgrade prompts, tier hooks
│
└── shared/                    # Cross-cutting — used across multiple features
    ├── components/
    │   ├── layout/            # Navbar, footer, page shell
    │   ├── marketing/         # Landing page sections, hero, CTAs
    │   ├── saas/              # Pricing cards, tier badges
    │   └── ui/                # Base components (shadcn/ui — button, card, dialog, etc.)
    ├── constants/
    │   ├── app.constants.ts   # Product identity — APP_NAME, CORE_FEATURE_SLUG, etc.
    │   └── subscription.constants.ts  # Tier definitions, Stripe price IDs, limits
    ├── hooks/                 # Shared React hooks
    ├── lib/
    │   ├── query-client.ts    # TanStack Query client setup
    │   └── query-keys.ts      # All cache keys — use these in useQuery calls
    ├── services/
    │   ├── api/               # authenticated-fetch, safe-fetch
    │   ├── firebase/          # Firebase client config
    │   ├── seo/               # generateMetadata, structured data
    │   └── ...
    ├── translations/
    │   └── en.json            # All user-facing strings (react-i18next)
    └── utils/
        ├── config/envUtil.ts  # All import.meta.env access — never use directly
        ├── error-handling/
        ├── permissions/       # core-feature-permissions.ts — tier-based access
        └── validation/        # Shared Zod helpers
```

---

## Backend structure (`backend/src/`)

```
backend/src/
│
├── index.ts                   # Entry point — creates Hono app, mounts all routes
│
├── routes/                    # Route handlers, organized by resource
│   ├── auth/index.ts          → /api/auth
│   ├── customer/index.ts      → /api/customer
│   ├── subscriptions/index.ts → /api/subscriptions
│   ├── reels/index.ts         → /api/reels
│   ├── generation/index.ts    → /api/generation
│   ├── queue/index.ts         → /api/queue
│   ├── admin/index.ts         → /api/admin
│   ├── users/index.ts         → /api/users
│   ├── analytics/index.ts     → /api/analytics
│   ├── public/index.ts        → /api/shared
│   ├── csrf.ts                → /api/csrf
│   └── health.ts              → /api/health
│
├── middleware/                # Hono middleware
│   ├── protection.ts          # authMiddleware, csrfMiddleware, rateLimiter, validateBody, validateQuery
│   └── security-headers.ts    # secureHeaders() — applied globally
│
├── services/                  # Business logic (called from routes)
│   ├── reels/
│   │   ├── reel-analyzer.ts   # Claude Haiku analysis
│   │   └── content-generator.ts  # Claude Sonnet generation
│   ├── firebase/admin.ts      # Firebase Admin SDK
│   ├── db/db.ts               # Drizzle client
│   ├── stripe/                # Stripe API wrappers
│   ├── email/                 # Resend email service
│   ├── scraping.service.ts    # Niche scraping/job queue
│   ├── rate-limit/            # Redis rate limiting
│   ├── csrf/                  # CSRF token generation/validation
│   └── observability/         # Prometheus metrics
│
├── constants/                 # Configuration constants
│   ├── stripe.constants.ts    # Stripe product/price IDs
│   ├── rate-limit.config.ts   # Rate limit configurations
│   └── subscription.constants.ts  # Tier definitions and limits
│
└── infrastructure/
    └── database/
        └── drizzle/
            ├── schema.ts      # Drizzle table definitions + relations
            └── migrations/    # SQL migrations (auto-generated by bun db:generate)
```

---

## Naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `user-profile.tsx`, `use-generator.ts` |
| React components | PascalCase | `UserProfile`, `CalcCard` |
| Functions/hooks | camelCase | `calculateTotal`, `useSubscription` |
| Constants | UPPER_SNAKE_CASE | `APP_NAME`, `MAX_RETRIES` |
| Types/interfaces | PascalCase | `UserProfile`, `GeneratorInput` |
| Route files (Hono) | noun/index.ts | `reels/index.ts`, `admin/index.ts` |

---

## Import patterns

### Frontend path aliases

`@/` maps to `frontend/src/`:

```typescript
// Correct — use path aliases
import { Button } from '@/shared/components/ui/button'
import { useApp } from '@/shared/contexts/app-context'
import { API_URL } from '@/shared/utils/config/envUtil'

// Wrong — relative paths are fragile and hard to read
import { Button } from '../../../shared/components/ui/button'
```

### Import order (frontend)

```typescript
// 1. External packages
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

// 2. Feature imports
import { GeneratorService } from '@/features/generator/services/generator-service'

// 3. Shared imports
import { Button } from '@/shared/components/ui/button'
import { queryKeys } from '@/shared/lib/query-keys'

// 4. Types
import type { GeneratorInput } from '@/features/generator/types/generator.types'
```

---

## Feature module contract

Every feature module follows a consistent internal structure. Using `reels` as the reference:

```
features/reels/
├── components/              # UI components (ReelList, PhonePreview, AnalysisPanel)
├── hooks/
│   ├── use-reels.ts         # React Query: fetch reel list
│   └── use-reel-analysis.ts # React Query: fetch/trigger analysis
├── services/
│   └── reels.service.ts     # API call wrappers (calls authenticated fetch utilities)
└── types/
    └── reels.types.ts       # TypeScript types for Reel, ReelAnalysis
```

---

## Component patterns

### Props pattern

```typescript
interface CardProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function Card({ title, description, children }: CardProps) {
  return <div>...</div>
}
```

### Data fetching

Always use TanStack Query for data fetching. Never call `fetch` directly in components.

```typescript
// GET requests with caching
const fetcher = useQueryFetcher()
const { data, isLoading } = useQuery({
  queryKey: queryKeys.api.generatorUsage(),
  queryFn: () => fetcher('/api/generator/usage'),
  enabled: !!user,
})

// Authenticated mutations
const { authenticatedFetchJson } = useAuthenticatedFetch()
await authenticatedFetchJson('/api/customer/profile', {
  method: 'PUT',
  body: JSON.stringify(updates),
})
```

### i18n

All user-facing strings go through react-i18next. Never hardcode visible text.

```typescript
import { useTranslation } from 'react-i18next'

export function MyComponent() {
  const { t } = useTranslation()
  return <p>{t('some.key')}</p>
}
```

---

## Related docs

- [API Architecture](./api.md) — Hono route patterns, middleware, rate limiting
- [Authentication](./authentication.md) — Firebase auth, requireAuth, route protection
- [Database](./database.md) — Prisma patterns, schema design

---

*Last updated: March 2026*
