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
│   │   ├── calculator/        # Core feature UI
│   │   ├── account/           # Profile, usage dashboard
│   │   ├── checkout/
│   │   └── payment/
│   └── admin/                 # Admin dashboard (admin role required)
│       ├── customers/
│       ├── orders/
│       ├── subscriptions/
│       └── ...
│
├── features/                  # Feature modules — domain business logic
│   ├── account/               # Usage dashboard, profile editor, subscription management
│   ├── admin/                 # Admin components: tables, modals, stats
│   ├── auth/                  # Auth guard, user button, useAuthenticatedFetch
│   ├── calculator/            # Default core feature (swappable)
│   │   ├── components/
│   │   ├── constants/         # CALCULATOR_CONFIG — types, tier requirements
│   │   ├── hooks/             # use-calculator.ts
│   │   ├── services/          # calculator-service.ts (pure logic)
│   │   └── types/             # Input/output types, Zod schemas
│   ├── contact/
│   ├── faq/
│   ├── payments/              # Checkout flow, payment success/cancel
│   └── subscriptions/         # Feature gating, upgrade prompts, tier hooks
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
├── routes/                    # Route handlers, one file per resource
│   ├── admin.ts
│   ├── calculator.ts
│   ├── customer.ts
│   ├── health.ts
│   ├── metrics.ts
│   ├── stripe-webhook.ts
│   ├── subscriptions.ts
│   └── users.ts
│
├── middleware/                # Hono middleware
│   └── protection.ts          # requireAuth, requireAdmin
│
├── services/                  # Business logic (called from routes)
│
└── infrastructure/
    └── database/
        ├── prisma/
        │   ├── schema.prisma  # Data model
        │   └── migrations/    # Auto-generated migrations
        └── lib/generated/     # Generated Prisma client (do not edit)
```

---

## Naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `user-profile.tsx`, `use-calculator.ts` |
| React components | PascalCase | `UserProfile`, `CalcCard` |
| Functions/hooks | camelCase | `calculateTotal`, `useSubscription` |
| Constants | UPPER_SNAKE_CASE | `APP_NAME`, `MAX_RETRIES` |
| Types/interfaces | PascalCase | `UserProfile`, `CalculatorInput` |
| Route files (Hono) | noun.ts | `calculator.ts`, `admin.ts` |

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
import { CalculatorService } from '@/features/calculator/services/calculator-service'

// 3. Shared imports
import { Button } from '@/shared/components/ui/button'
import { queryKeys } from '@/shared/lib/query-keys'

// 4. Types
import type { CalculatorInput } from '@/features/calculator/types/calculator.types'
```

---

## Feature module contract

Every feature module should have a consistent internal structure. Using the calculator as the reference:

```
features/calculator/
├── components/               # UI components
├── constants/
│   └── calculator.constants.ts  # Config: types, tier requirements, metadata
├── hooks/
│   └── use-calculator.ts    # Client-side: calls API, checks access
├── services/
│   └── calculator-service.ts  # Pure logic (no side effects)
└── types/
    ├── calculator.types.ts  # Input/output TypeScript types
    └── calculator-validation.ts  # Zod schemas for API validation
```

When replacing the core feature with your own product, your new feature module should follow this same structure. See [TEMPLATE_GUIDE.md](../../TEMPLATE_GUIDE.md) for the full swap guide.

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
  queryKey: queryKeys.api.calculatorUsage(),
  queryFn: () => fetcher('/api/calculator/usage'),
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
