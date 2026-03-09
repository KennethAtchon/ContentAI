# Contributing Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Running the App](#running-the-app)
6. [Running Tests](#running-tests)
7. [Code Style](#code-style)
8. [Making Changes](#making-changes)
9. [Submitting a Pull Request](#submitting-a-pull-request)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Bun](https://bun.sh) | 1.3.6+ | Runtime + package manager + test runner |
| [Node.js](https://nodejs.org) | 20+ | Required by some tooling (TypeScript, ESLint) |
| [PostgreSQL](https://www.postgresql.org) | 15+ | Primary database |
| [Redis](https://redis.io) | 7+ | Session / rate-limiting / caching |
| [Firebase project](https://firebase.google.com) | — | Auth + Firestore (for dev, use a personal project) |

**Install Bun:**

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd WebsiteTemplate/project
bun install
```

### 2. Copy and fill environment variables

```bash
cp example.env .env
```

Edit `.env` with your local credentials. See [Environment Variables](#environment-variables) for what each variable does.

Minimum required for local development:

```
APP_ENV=development
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/reelstudio
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_FIREBASE_API_KEY=...  (from your Firebase project settings)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_CLIENT_EMAIL=...  (from Firebase service account JSON)
FIREBASE_PRIVATE_KEY=...
CSRF_SECRET=<output of: openssl rand -hex 32>
ENCRYPTION_KEY=<32 random characters>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Start PostgreSQL and Redis

Using Docker Compose (recommended for local dev):

```bash
# From the workspace root (not /project)
docker compose up -d postgres redis
```

Or start them manually if already installed locally.

### 4. Set up the database

```bash
cd project
bun run db:generate   # Generate Prisma client
bun run db:migrate    # Run migrations (creates tables)
```

### 5. Start the development server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
project/
├── app/                      # Next.js App Router pages and API routes
│   ├── (public)/             # Public marketing pages (no auth)
│   ├── api/                  # API routes
│   └── ...
├── features/                 # Feature-based code organization
│   ├── admin/                # Admin dashboard components
│   ├── auth/                 # Firebase authentication
│   ├── generator/           # Core generator feature
│   └── payments/             # Stripe payment flows
├── shared/                   # Shared utilities, services, components
│   ├── components/           # Reusable UI components
│   ├── hooks/                # Shared React hooks
│   ├── lib/                  # Query client, query keys
│   ├── middleware/           # API route protection helpers
│   ├── providers/            # React context providers
│   ├── services/             # External service clients (DB, Redis, Firebase, etc.)
│   └── utils/                # Pure utility functions
├── infrastructure/
│   └── database/
│       └── prisma/           # Prisma schema and migrations
├── translations/             # i18n translation files (en.json)
└── __tests__/
    ├── unit/                 # Bun unit tests
    ├── integration/          # Bun integration tests (API routes)
    ├── e2e/                  # Playwright E2E tests (requires live app)
    ├── helpers/              # Shared test helpers and fixtures
    └── setup/                # Bun preload and test configuration
```

Full architecture documentation: [`docs/AI_Orchestrator/`](docs/AI_Orchestrator/)

---

## Environment Variables

All environment variables are accessed through `project/shared/utils/config/envUtil.ts` — never use `process.env` directly in application code.

See [`project/example.env`](project/example.env) for the full list with descriptions.

**Generating secrets:**

```bash
# CSRF_SECRET (must be 64 hex chars = 32 bytes)
openssl rand -hex 32

# ENCRYPTION_KEY (32 characters)
openssl rand -base64 24 | head -c 32

# ADMIN_SPECIAL_CODE_HASH (bcrypt hash of your chosen admin code)
node -e "const b = require('bcryptjs'); b.hash('your-admin-code', 12).then(console.log)"
```

---

## Running the App

```bash
bun dev          # Development server with Turbopack (http://localhost:3000)
bun build        # Production build
bun start        # Start production server (requires bun build first)
bun run lint     # ESLint
bun run format   # Prettier (auto-fix)
```

---

## Running Tests

Tests use **Bun's built-in test runner**. Unit and integration tests must be run separately due to a [Bun mock isolation issue](https://github.com/oven-sh/bun/issues/25712).

```bash
# Run unit tests only
bun test __tests__/unit

# Run integration tests only
bun test __tests__/integration

# Run both (CI mode — runs them separately, then combines coverage)
bun run test:ci

# Run with coverage
bun test __tests__/unit --coverage

# Watch mode (unit tests)
bun test:watch

# E2E tests (requires live app + Firebase test account)
bun run test:e2e
```

**Important:** Do not run `bun test` (which runs everything at once) — it causes test isolation failures due to the Bun bug linked above. Use `test:ci` or run the groups separately.

---

## Code Style

- **TypeScript**: Strict mode. No `any` unless absolutely necessary.
- **Formatting**: Prettier (config in `.prettierrc`). Run `bun run format` before committing.
- **Linting**: ESLint with Next.js rules. Run `bun run lint`.
- **Strings**: Always use `useTranslations()` / `getTranslations()` from `next-intl`. Never hardcode user-facing strings.
- **API calls**: Never use `fetch` directly. Use React Query + `useQueryFetcher` for GET, `useAuthenticatedFetch` for authenticated calls.
- **Env vars**: Never use `process.env` directly. Always go through `envUtil.ts`.
- **Error handling**: Use `withStandardErrorHandling` / `withApiErrorHandling` from `api-error-wrapper.ts` on all API routes.

See [`CLAUDE.md`](CLAUDE.md) at the workspace root for the full code-pattern rules.

---

## Making Changes

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes following the code style above.
3. Run `bun run build:all` (lint + format check + type check + build) to verify nothing is broken.
4. Run `bun run test:ci` to confirm all tests pass.
5. Update relevant checklist items in `docs/checklists/` if applicable.
6. Update `docs/AI_Orchestrator/` if you're adding or changing architecture.

---

## Submitting a Pull Request

1. Push your branch and open a PR against `master` (or `develop` if it exists).
2. The CI pipeline (`.github/workflows/ci.yml`) runs automatically: lint → unit tests → integration tests → build → security audit.
3. All CI jobs must be green before merge.
4. Request a review from a maintainer.
