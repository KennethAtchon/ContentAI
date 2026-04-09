# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ReelStudio** — AI-powered content intelligence platform. Users discover viral Instagram reels, get AI-generated breakdowns, then generate original hooks/captions/scripts and schedule them. SaaS with Firebase auth, Stripe subscriptions, PostgreSQL, and Anthropic Claude.

## Commands

All commands run from the respective subdirectory.

### Frontend (`cd frontend`)
```bash
bun run dev          # Dev server on port 3000
bun run build        # Production build
bun run lint         # ESLint
bun run type-check   # tsc --noEmit
bun test             # All tests
bun test __tests__/unit                    # Unit tests only
bun test __tests__/unit/features/editor   # Single test folder
bun test --watch     # Watch mode
```

### Backend (`cd backend`)
```bash
bun run dev          # API server on port 3001 (hot reload)
bun run build        # Bundle to dist/
bun run lint         # ESLint
bun test             # All tests
bun test __tests__/unit   # Unit tests only
bun run db:generate  # Generate Drizzle migrations after schema change
bun run db:migrate   # Apply migrations
bun run db:studio    # Open Drizzle Studio UI
bun run db:reset     # Reset DB (dev only)
```

## Architecture

Split monorepo: React SPA + Hono API server. No shared code between frontend and backend — they communicate over HTTP only.

### Frontend (`frontend/src/`)

- **Routing**: TanStack Router with file-based routes in `src/routes/`. Route groups: `(public)/`, `(auth)/`, `(customer)/`, `studio/`, `admin/`.
- **Features**: Domain logic lives in `src/features/<feature>/` (components, hooks, services, types). No cross-feature imports.
- **Shared**: `src/shared/` — only for things used across multiple features. `shared/lib/query-keys.ts` is the single source of truth for all TanStack Query cache keys.
- **Auth**: `AppContext` (`shared/contexts/`) holds `user`, `profile`, `isAdmin`. `AuthGuard` in `features/auth/` handles route protection. Firebase ID token is sent as `Authorization: Bearer <token>` on every API call via `useAuthenticatedFetch`.
- **State**: TanStack Query for all server state. No global client state library — use local state or context for UI-only state.
- **Constants**: `shared/constants/app.constants.ts` — product identity (APP_NAME, etc.). `shared/constants/subscription.constants.ts` — tier definitions, Stripe price IDs, limits.

### Backend (`backend/src/`)

Entry point: `src/index.ts` — mounts all routes at `/api/<resource>`.

**Middleware stack per protected route** (in order):
1. `rateLimiter()` — Redis-backed rate limiting
2. `csrfMiddleware()` — CSRF token validation
3. `authMiddleware("user" | "admin")` — Firebase token verification + DB user upsert → sets `c.get("auth")`

Route handlers call `c.get("auth")` to get the verified user. Never verify the token twice in a handler.

**Services** (`src/services/`) contain all business logic. Routes are thin — they validate input, call a service, return the result.

**Validation**: Use `@hono/zod-validator` middleware (`validateBody()` / `validateQuery()`) on routes. No manual body parsing.

### Database

**ORM: Drizzle ORM** (not Prisma). Schema at `backend/src/infrastructure/database/drizzle/schema.ts`.

PostgreSQL tables: `user`, `order`, `contact_message`, `feature_usage`, `niche`, `reel`, `reel_analysis`, `generated_content`, `instagram_page`, `queue_item`.

**Critical split**: Subscriptions live in **Firestore** (managed by the `ext-firestore-stripe-payments` Firebase extension), not PostgreSQL. Orders (one-time purchases) live in PostgreSQL. Never query PostgreSQL for subscription status — read from the Firebase custom claim `stripeRole` on the JWT.

### Billing / Subscriptions

Subscription tier is encoded in the Firebase JWT as the `stripeRole` custom claim. The backend reads this claim on every request — no database call needed for tier checks.

Checkout flow: frontend writes to Firestore → Firebase extension creates Stripe Checkout → extension sets `stripeRole` claim after payment. The app never directly calls Stripe during checkout. Plan changes go through the Stripe Customer Portal only.

Usage limits (AI generation count) are tracked in PostgreSQL (`feature_usage` table) and enforced server-side before every generation request.

### Editor System

The timeline editor is the most complex subsystem. Key concepts:

- **Composition**: One per user+content pair. Holds the `timeline` (tracks: video, audio, text overlays, captions) and a `version` number. Persisted in PostgreSQL.
- **Clip trim convention**: `trimStartMs` + `durationMs` + `trimEndMs` === `sourceMaxDurationMs`. `trimEndMs` is the unused tail (not an absolute timestamp). All server-side clip creation must follow this shape.
- **Init flow**: `POST /api/editor/init` creates the composition on first visit (builds default timeline from assets); returns existing on subsequent visits. Frontend then GETs the composition to set the undo baseline.
- **Local-first edits**: All edits update local React state immediately via `editorReducer` in `frontend/src/features/editor/model/`. Autosave debounces 800ms, hashes the timeline to detect real changes, sends to server.
- **Conflict detection**: Every save includes `expectedVersion`. Server returns 409 if versions diverge (another tab saved). No auto-merge — user must refresh.
- **Rendering**: Separate from saving. Uses the DB version (not local state). Redis lock prevents duplicate render jobs for the same version.
- **Undo/redo**: Pure in-memory history stack. No network calls — autosave handles persistence.

Reducer is split across files: `editor-reducer.ts` (dispatch), `editor-reducer-clip-ops.ts`, `editor-reducer-track-ops.ts`, `editor-reducer-session-ops.ts`, `editor-reducer-helpers.ts`.

## Development Phase

This app is in active development. There are no production users. The database can and will be reset at any time.

**Never write backwards compatibility workarounds.** When a design changes:
- Delete the old code. All of it.
- Update every call site to the new interface.
- Run `bun run db:reset` if the schema changes. Do not write migrations to preserve old data.
- Do not write `LEGACY_ID_MAP`, adapter functions, `@deprecated` wrappers, or "temporary" shims.
- Do not keep old files "for reference." Delete them.

Backwards compatibility is a production concern. We are not in production. Writing compatibility code now is wasted work that makes the codebase harder to reason about.

## Key Patterns

**Backend route pattern:**
```typescript
import { authMiddleware } from "../../middleware/...";
// compose: rateLimiter, csrfMiddleware, authMiddleware, then handler
const auth = c.get("auth"); // DecodedIdToken + db user
```

**Frontend API calls:** Always use `useAuthenticatedFetch` (from `features/auth/`) which attaches the Bearer token and CSRF header automatically.

**Query keys:** Import from `shared/lib/query-keys.ts` — do not inline string keys.

**Disabled controls:** Every disabled button or other interactive control must explain why it is disabled via a `title` attribute or adjacent helper text.

**i18n:** All user-visible strings go through `react-i18next` (`t('key')`). Translation files at `frontend/src/translations/en.json`.

**Testing:** Bun's built-in test runner. Frontend unit tests in `frontend/__tests__/unit/`. Use `bun:test` imports (`describe`, `test`, `expect` from `"bun:test"`).
