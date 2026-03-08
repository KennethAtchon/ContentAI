# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use **Bun** (`bun@1.2.14`). Run from the respective `frontend/` or `backend/` directory.

### Frontend (`frontend/`)
```bash
bun dev                # Vite dev server (port 3000)
bun build              # Production build
bun lint               # ESLint (zero warnings allowed)
bun format             # Prettier write
bun test               # All tests
bun test:unit          # Unit tests only
bun test:integ         # Integration tests only
bun test:watch         # Watch mode
bun test:coverage      # Unit tests with coverage
```

Run a single test file:
```bash
bun test __tests__/unit/utils/date.test.ts
```

### Backend (`backend/`)
```bash
bun dev                # Hot-reload dev server (port 3001)
bun test               # All tests
bun test:unit          # Unit tests only
bun db:generate        # Drizzle generate (after schema changes)
bun db:migrate         # Drizzle migrate
bun db:studio          # Drizzle Studio GUI
bun lint               # ESLint
```

---

## Architecture

This is a **monorepo** with two independent servers that share no code at runtime:

- **`frontend/`** — React 19 SPA (Vite + TanStack Router)
- **`backend/`** — Hono API server (Bun runtime)

### Frontend Stack

| Concern | Library |
|---|---|
| Routing | TanStack Router (file-based, `src/routes/`) |
| Data fetching | TanStack Query (React Query v5) |
| Auth | Firebase (client SDK) |
| UI components | Radix UI + shadcn/ui (`src/shared/components/ui/`) |
| Styling | Tailwind CSS v4 |
| Forms | react-hook-form + zod |
| i18n | react-i18next |
| Animations | Framer Motion |

**Route groups** in `src/routes/`:
- `(public)/` — unauthenticated pages
- `(auth)/` — sign-in, sign-up
- `(customer)/` — authenticated customer pages
- `admin/` — admin dashboard

**Feature structure** (`src/features/<feature>/`): each feature contains `components/`, `hooks/`, `services/`, and `types/`.

**Shared code** lives in `src/shared/` and is used across features: `components/`, `hooks/`, `services/`, `utils/`, `constants/`, `lib/`.

### Backend Stack

| Concern | Library |
|---|---|
| HTTP framework | Hono |
| Database | PostgreSQL via Drizzle ORM (schema: `src/infrastructure/database/drizzle/schema.ts`) |
| Cache / rate limiting | Redis (ioredis) |
| Auth | Firebase Admin SDK |
| Payments | Stripe |
| Email | Resend |
| Storage | Cloudflare R2 (AWS S3-compatible) |
| Observability | Prometheus (`prom-client`) |

Routes in `src/routes/` are mounted on `/api/<resource>` in `src/index.ts`. Auth is enforced via `requireAuth`/`requireAdmin` middleware from `src/middleware/protection.ts`.

---

## Code Patterns

### API Calls & Data Fetching

**NEVER use `fetch` directly.** Use the established patterns:

- **For GET requests with caching:** Use React Query with `useQueryFetcher`
  ```typescript
  const fetcher = useQueryFetcher();
  const { data } = useQuery({
    queryKey: queryKeys.api.someResource(),
    queryFn: () => fetcher("/api/some-resource"),
    enabled: !!user,
  });
  ```
  Use `queryKeys` from `@/shared/lib/query-keys` for all cache keys.

- **For authenticated API calls (mutations, POST/PUT/DELETE):** Use `useAuthenticatedFetch`
  ```typescript
  const { authenticatedFetch, authenticatedFetchJson } = useAuthenticatedFetch();
  const data = await authenticatedFetchJson<Type>(url);
  ```

- **For server-side API calls:** Use `authenticatedFetchJson` from `@/shared/services/api/authenticated-fetch`

### Internationalization (i18n)

**ALWAYS use translations.** Never hardcode user-facing strings.

- Use `useTranslation()` hook from `react-i18next` in components
- Translation keys live in `frontend/src/translations/en.json`
- Check existing keys before adding new ones

```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
// <p>{t("some.key")}</p>
```

### Environment Variables

**NEVER use `process.env` or `import.meta.env` directly.** Always use `envUtil`.

- **Frontend** (`src/shared/utils/config/envUtil.ts`): accesses `import.meta.env`, vars prefixed with `VITE_`
- **Backend** (`src/utils/config/envUtil.ts`): accesses `process.env`, no prefix needed
- Add new vars to `envUtil.ts` first, then use the exported constant

```typescript
// ❌ WRONG
const apiUrl = import.meta.env.VITE_API_URL;

// ✅ CORRECT
import { API_URL } from "@/shared/utils/config/envUtil";
```

For constants that don't vary by environment, use regular `const` — not env vars.

### General Principles

- **Follow existing patterns** — read similar files before writing new code
- **Feature-based organization** — new features go in `src/features/<feature>/`
- **Update AI_Orchestrator docs** — when making code changes, update relevant docs in `docs/AI_Orchestrator/`

---

## Testing

Both frontend and backend use **Bun's built-in test runner**.

### Frontend Tests

Test setup is in `__tests__/setup/bun-preload.ts` (loaded automatically via `bunfig.toml`). It:
- Registers Happy DOM (DOM environment for React Testing Library)
- Sets test env vars
- Mocks Firebase, auth middleware, rate limiters, and other heavy dependencies via `global.__testMocks__`

To override a mock in a specific test, use `(global as any).__testMocks__.<service>.<method>.mockResolvedValue(...)`.

### Backend Tests

Test setup is in `__tests__/setup/bun-preload.ts`. Integration tests use a helper in `__tests__/helpers/create-test-app.ts` that builds a real Hono app with mocked middleware.

Tests run with `concurrency = 1` (serial) to avoid race conditions.
