# Project Overview

This is **ReelStudio** — an AI-powered content intelligence platform for creators and marketers. Users discover viral reels in any niche, get AI analysis explaining exactly why they perform, then generate hooks, captions, and scripts inspired by that data — and schedule them for publishing.

The platform is built on a SaaS template with auth, subscriptions, payments, and admin infrastructure already implemented. The core feature has been migrated from a studio tool template to the ReelStudio workspace.

---

## Tech stack

### Frontend (`frontend/`)

| Concern | Library |
|---------|---------|
| Framework | React 19 |
| Build tool | Vite |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Data fetching | TanStack Query (React Query v5) |
| Auth | Firebase client SDK |
| UI components | Radix UI + shadcn/ui |
| Styling | Tailwind CSS v4 |
| Forms | react-hook-form + Zod |
| Animations | Framer Motion |
| i18n | react-i18next |
| Testing | Bun test runner |

### Backend (`backend/`)

| Concern | Library |
|---------|---------|
| Runtime | Bun |
| HTTP framework | Hono |
| Database ORM | Prisma (PostgreSQL) |
| Cache / rate limiting | Redis (ioredis) |
| Auth | Firebase Admin SDK |
| Payments | Stripe |
| Email | Resend |
| Storage | Cloudflare R2 (S3-compatible) |
| Observability | Prometheus (`prom-client`) |
| Testing | Bun test runner |

---

## Folder structure

```
WebsiteTemplate2/
├── frontend/                  # React SPA
│   └── src/
│       ├── routes/            # File-based routes (TanStack Router)
│       │   ├── (public)/      # Unauthenticated pages
│       │   ├── (auth)/        # Sign-in, sign-up
│       │   ├── (customer)/    # Authenticated customer pages
│       │   ├── studio/        # Studio workspace routes
│       │   └── admin/         # Admin dashboard
│       ├── features/          # Feature modules
│       │   ├── account/
│       │   ├── admin/
│       │   ├── auth/
│       │   ├── generation/    # AI content generation
│       │   ├── reels/         # Reel discovery and analysis
│       │   ├── studio/        # Main studio workspace
│       │   ├── payments/
│       │   └── subscriptions/
│       └── shared/            # Cross-cutting: components, hooks, services, utils
│           ├── components/
│           ├── constants/     # app.constants.ts — product identity
│           ├── hooks/
│           ├── lib/           # React Query client, query keys
│           ├── services/      # API, Firebase, SEO, storage, etc.
│           └── utils/         # envUtil, error handling, permissions, validation
│
├── backend/                   # Hono API server
│   └── src/
│       ├── index.ts           # Entry point — mounts all routes
│       ├── routes/            # API route handlers (mounted at /api/<resource>)
│       ├── middleware/        # Auth middleware (requireAuth, requireAdmin)
│       ├── services/          # Business logic services
│       └── infrastructure/
│           └── database/      # Prisma schema and migrations
│
├── e2e/                       # Playwright end-to-end tests
└── docs/                      # This folder
```

---

## System architecture

```
┌─────────────────────────────────────────────┐
│            Browser (React SPA)              │
│   Vite · TanStack Router · TanStack Query   │
│   Firebase SDK (auth, tokens)               │
└──────────────────┬──────────────────────────┘
                   │ HTTPS  Authorization: Bearer {token}
                   │
┌──────────────────▼──────────────────────────┐
│           Backend (Hono / Bun)              │
│   /api/* routes                             │
│   requireAuth / requireAdmin middleware     │
│   Prisma ORM                                │
└────────┬──────────────┬──────────────┬──────┘
         │              │              │
    ┌────▼────┐   ┌──────▼─────┐  ┌───▼────┐
    │PostgreSQL│   │  Firebase  │  │ Stripe │
    │ Prisma  │   │ Auth Admin │  │  API   │
    └─────────┘   └────────────┘  └────────┘
         │
    ┌────▼────┐
    │  Redis  │
    │rate lmt │
    └─────────┘
```

The frontend never talks to the database directly. All data access goes through the Hono API. The Firebase client SDK is used only for authentication (sign-in, token management); all token verification happens server-side with the Firebase Admin SDK.

---

## Authentication flow

1. User signs in via Firebase Auth (email/password or Google OAuth)
2. Firebase returns a JWT ID token
3. Frontend attaches the token as `Authorization: Bearer {token}` on every API request
4. Backend `requireAuth` middleware verifies the token with Firebase Admin SDK
5. On first request, the user is auto-provisioned in PostgreSQL
6. Role-based access: `role: "user"` (default) or `role: "admin"` — stored in PostgreSQL and synced to Firebase custom claims

---

## Key systems

### Subscription system
- Three tiers: Basic, Pro, Enterprise
- Stripe Checkout for payment, Firebase Stripe Extension to sync subscription state to Firestore
- Subscription tier stored as a Firebase custom claim (`stripeRole`)
- Usage limits enforced server-side per tier

### Core feature (ReelStudio)
- **Discovery**: Search niches and surface top-performing reels
- **Analysis**: AI breakdown of hook patterns, emotional triggers, format
- **Generation**: AI-powered content remix (hooks, captions, scripts)
- **Queue**: Schedule and manage content for publishing
- Usage tracked and limited per subscription tier
- Feature gates enforced server-side

### Admin system
- Dashboard with business metrics (MRR, ARPU, churn)
- Customer, order, subscription management
- Protected by `requireAdmin` middleware — checks `role: "admin"` in database (source of truth) and syncs to Firebase custom claims

### Security
- Rate limiting: Redis-backed, keyed by Firebase UID (authenticated) or IP (unauthenticated)
- CSRF: Encrypted tokens (AES-256-GCM) bound to Firebase UID, required on all authenticated mutations
- CORS: Allowlist-based, configured via environment variable
- Input validation: Zod schemas on all API inputs
- PII sanitization: Automatic redaction in logs

---

## API routes

Routes live in `backend/src/routes/` and are mounted at `/api/<resource>` in `backend/src/index.ts`.

| Prefix | Purpose |
|--------|---------|
| `/api/customer/` | Authenticated customer endpoints (profile, orders) |
| `/api/admin/` | Admin-only endpoints (customers, orders, subscriptions, analytics) |
| `/api/reels/` | Reel discovery, analysis, and niche scanning |
| `/api/generation/` | AI content generation and history |
| `/api/queue/` | Content queue management and scheduling |
| `/api/subscriptions/` | Subscription status and checkout |
| `/api/stripe-webhook` | Stripe webhook handler |
| `/api/health` | Health check, liveness, readiness probes |
| `/api/metrics` | Prometheus metrics endpoint |

---

## Database schema (PostgreSQL)

Managed by Prisma. Schema at `backend/src/infrastructure/database/prisma/schema.prisma`.

| Model | Purpose |
|-------|---------|
| `User` | User accounts, roles, profile data |
| `Reel` | Instagram reel data and metrics |
| `ReelAnalysis` | AI analysis results for reels |
| `GeneratedContent` | AI-generated hooks, captions, scripts |
| `QueueItem` | Content scheduling and publishing queue |
| `Order` | One-time purchases |
| `FeatureUsage` | Per-user usage history and tracking |
| `ContactMessage` | Contact form submissions |

Subscriptions live in **Firestore** (managed by the Firebase Stripe Extension), not PostgreSQL. This is intentional — see [architecture/domain/business-model.md](./domain/business-model.md) for the rationale.

---

## Development setup

```bash
# Frontend
cd frontend
bun install
bun dev          # http://localhost:3000

# Backend
cd backend
bun install
bun db:generate  # After schema changes
bun db:migrate   # Apply migrations
bun dev          # http://localhost:3001
```

Run tests:

```bash
cd frontend && bun test
cd backend && bun test
```

---

## Environment variables

Both servers have separate `.env` files. Never use `process.env` or `import.meta.env` directly — always go through `envUtil.ts`:

- **Frontend:** `frontend/src/shared/utils/config/envUtil.ts` — accesses `import.meta.env`, variables prefixed with `VITE_`
- **Backend:** `backend/src/utils/config/envUtil.ts` — accesses `process.env`, no prefix needed

---

*Last updated: March 2026*
