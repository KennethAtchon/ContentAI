# Backend Reorganization Plan

> **Scope:** `backend/src/` — full structural overhaul for long-term maintainability.
> **Goal:** Routes that are thin HTTP adapters. Services that contain all business logic. Repositories that own all database access. A structure where adding a feature means adding one file in a predictable place, not hunting across 4 directories.
> **Not in scope:** expanding **automated unit/integration tests** or requiring **repository mocks** as part of this plan (**§11**).

---

## Table of Contents

1. [Current Problems](#1-current-problems)
2. [New Directory Structure](#2-new-directory-structure)
3. [Route-by-Route Breakdown](#3-route-by-route-breakdown)
4. [Service Layer Rules](#4-service-layer-rules)
5. [Repository Layer (New)](#5-repository-layer-new)
6. [Type System Consolidation](#6-type-system-consolidation)
7. [Validation Consolidation](#7-validation-consolidation)
8. [Error Handling Standardization](#8-error-handling-standardization)
9. [Infrastructure Consolidation](#9-infrastructure-consolidation)
10. [Dead Code to Delete](#10-dead-code-to-delete)
11. [Migration Sequence](#11-migration-sequence)
12. [Appendix: Current layout, decisions, verification](#12-appendix-current-layout-decisions-verification)

---

## 1. Current Problems

### 1.1 Route Files Are 1,000–2,362 Lines

The four worst offenders contain full business logic, database queries, and orchestration pipelines inside HTTP handler callbacks:

| File | Lines | What it contains that doesn't belong |
|---|---|---|
| `routes/editor/index.ts` | 2,362 | FFmpeg filter chain building, timeline composition, clip normalization, caption processing, export orchestration |
| `routes/admin/index.ts` | 1,254 | Analytics aggregation, customer management, cost calculations, config management, all mixed |
| `routes/video/index.ts` | 1,230 | Job creation, provider selection, rendering pipeline, status polling |
| `routes/queue/index.ts` | 1,061 | Pipeline stage derivation, content iteration logic, multi-step orchestration |

A route handler should do: validate input → call a service → return the result. When a route handler is 200 lines, it's doing service work.

### 1.2 No Repository Layer

Database queries are written inline inside route handlers and service functions, sometimes in both. There is no abstraction between the Drizzle schema and the business logic. This means:
- Changing a column name requires finding every `db.select().from(users).where(...)` scattered across 18 route files and 40 service files
- Without repositories, any caller of business logic must hit a real database or reach into Drizzle directly
- The same query is written multiple times in different files

### 1.3 Validation Is Inconsistent

Two approaches coexist in the same codebase with no rule for which to use:

```typescript
// Approach 1: Zod + @hono/zod-validator (projects, chat routes)
app.post("/", zValidator("json", createSchema), async (c) => {
  const { name } = c.req.valid("json"); // type-safe
});

// Approach 2: Manual (generation, admin routes)
const body = await c.req.json();
const { sourceReelId, prompt } = body; // untyped, no schema
if (!sourceReelId || !prompt?.trim()) {
  return c.json({ error: "..." }, 400);
}
```

Approach 2 produces untyped request bodies, duplicate validation logic, and inconsistent error messages.

### 1.4 Error Responses Have Three Different Shapes

```typescript
// Shape 1: error only
return c.json({ error: "User not found" }, 404);

// Shape 2: error + code
return c.json({ error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" }, 429);

// Shape 3: error + code + details
return c.json({ error: "Validation failed", code: "INVALID_INPUT", details: zodError }, 422);
```

Clients that consume this API must handle three response shapes for errors. There should be one.

### 1.5 Service Directory Has No Consistent Internal Structure

`services/` has 15 subdirectories with no enforced pattern:
- Some subdirectories have a single `*.ts` file
- Some have `*.service.ts`, `*.client.ts`, `*.helpers.ts` with no consistent naming
- Some business logic lives in `routes/*/` not in `services/`
- The `reels/` service is actually content generation, while scraping lives separately

The result: you cannot guess where logic lives. You must search.

### 1.6 Types Are Scattered

- `src/types/api.types.ts` — global response types
- `src/features/*/types/` — feature-specific types
- `src/middleware/protection.ts` — `AuthResult`, `HonoEnv`, middleware types (inline)
- Drizzle inferred types (implicit from schema)
- `any` and `unknown` for JSONB fields (no strict typing for `generatedContent.generatedMetadata`, `editProjects.tracks`, etc.)

The JSONB fields are the most dangerous. `editProjects.tracks` is the entire timeline state, stored as `unknown`. Bugs in timeline serialization are invisible until runtime.

### 1.7 Business Logic Functions Defined Inside Route Handlers

Examples found:
- `buildFfmpegAtempoChain()` defined inside `editor/index.ts`
- `deriveStages()` defined inside `queue/index.ts`
- Inline cost calculation logic in `admin/index.ts`

These are pure functions. They should live in service/utility files, not inside handlers.

---

## 2. New Directory Structure

The reorganization introduces two new concepts:
1. **Repositories** — own all Drizzle database queries
2. **Domain services** — own business logic, call repositories, no HTTP concerns

Routes become thin: parse + validate request → call domain service → return response.

```
src/
│
├── config/                   ← unchanged
├── constants/                ← unchanged
│
├── domain/                   ← NEW: all business domains
│   ├── admin/
│   │   ├── admin.service.ts
│   │   ├── admin.repository.ts
│   │   └── admin.types.ts
│   ├── assets/
│   │   ├── assets.service.ts
│   │   ├── assets.repository.ts
│   │   └── assets.types.ts
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts  ← user upsert, lookup by firebaseUid
│   │   └── auth.types.ts
│   ├── chat/
│   │   ├── chat.service.ts
│   │   ├── chat.repository.ts
│   │   ├── streaming/
│   │   │   └── sse.service.ts
│   │   └── chat.types.ts
│   ├── content/              ← generatedContent + generation pipeline
│   │   ├── content.service.ts
│   │   ├── content.repository.ts
│   │   └── content.types.ts
│   ├── customer/
│   │   ├── customer.service.ts
│   │   ├── customer.repository.ts
│   │   └── customer.types.ts
│   ├── editor/
│   │   ├── editor.service.ts
│   │   ├── editor.repository.ts
│   │   ├── captions/
│   │   │   ├── caption.service.ts
│   │   │   └── ass-generator.ts
│   │   ├── export/
│   │   │   ├── export.service.ts
│   │   │   └── render.service.ts
│   │   ├── timeline/
│   │   │   ├── timeline-builder.ts
│   │   │   └── composition.ts
│   │   └── editor.types.ts
│   ├── media/
│   │   ├── media.service.ts
│   │   ├── media.repository.ts
│   │   └── media.types.ts
│   ├── music/
│   │   ├── music.service.ts
│   │   ├── music.repository.ts
│   │   └── music.types.ts
│   ├── queue/
│   │   ├── queue.service.ts
│   │   ├── queue.repository.ts
│   │   ├── pipeline/
│   │   │   ├── stage-derivation.ts
│   │   │   └── content-iteration.ts
│   │   └── queue.types.ts
│   ├── reels/
│   │   ├── reels.service.ts
│   │   ├── reels.repository.ts
│   │   └── reels.types.ts
│   ├── subscriptions/
│   │   ├── subscriptions.service.ts
│   │   └── subscriptions.types.ts
│   ├── users/
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── users.types.ts
│   └── video/
│       ├── video.service.ts      ← orchestration / job lifecycle (when introduced)
│       ├── video.repository.ts
│       └── video.types.ts
│
├── infrastructure/
│   └── database/drizzle/     ← schema + migrations (unchanged)
│
├── jobs/                     ← background jobs (unchanged)
│
├── lib/                      ← AI client, chat tools (unchanged)
│
├── middleware/               ← unchanged: auth, CSRF, rate limiting, security
│
├── prompts/                  ← AI system prompts (unchanged)
│
├── routes/                   ← THIN ONLY: validate + delegate to domain
│   ├── admin/index.ts        ← target: <200 lines
│   ├── analytics/index.ts    ← already small, fine
│   ├── assets/index.ts
│   ├── audio/index.ts
│   ├── auth/index.ts
│   ├── chat/index.ts
│   ├── customer/index.ts
│   ├── editor/index.ts       ← thin mount; sub-routers below (see §3.1, §12.2)
│   ├── generation/index.ts
│   ├── health/index.ts
│   ├── media/index.ts
│   ├── music/index.ts
│   ├── projects/index.ts
│   ├── public/index.ts
│   ├── queue/index.ts        ← target: <200 lines
│   ├── reels/index.ts
│   ├── subscriptions/index.ts
│   ├── users/index.ts
│   └── video/index.ts        ← target: <200 lines
│
├── services/                 ← INFRASTRUCTURE ONLY (not business logic)
│   ├── config/               ← system config + seed
│   ├── csrf/                 ← CSRF token service
│   ├── db/                   ← db.ts + redis.ts (connection management)
│   ├── email/                ← Resend integration
│   ├── firebase/             ← Firebase admin init + sync
│   ├── observability/        ← metrics, logging
│   ├── rate-limit/           ← Redis rate limiter
│   ├── scraping/             ← Instagram scraping
│   ├── storage/              ← R2 storage
│   ├── timezone/
│   ├── tts/                  ← ElevenLabs TTS
│   └── video-generation/     ← provider adapters + provider-selector.ts
│
├── shared/                   ← Pure utilities with no domain knowledge
│
├── types/
│   ├── api.types.ts          ← ApiResponse<T>, PaginatedResponse<T>, ApiError
│   ├── hono.types.ts         ← HonoEnv, Variables (move from middleware)
│   └── timeline.types.ts     ← NEW: strict types for JSONB timeline state
│
└── utils/                    ← unchanged
```

Third-party video model clients (FAL, Runway, Ken Burns) live under **`services/video-generation/`**, not under `domain/video/` — see §9.3 and §12.1.

**Key structural decision:** `domain/` is new. It separates business logic from infrastructure services. The rule is:
- `domain/` knows about the database schema (via repositories) and calls infrastructure services (email, storage, TTS)
- `services/` knows about external systems (Firebase, Redis, Resend, R2) and provides adapters
- `routes/` knows about HTTP only

**Video providers (resolved):** An earlier draft placed provider modules under `domain/video/providers/`. The adopted split is: **HTTP/model SDK adapters** in `services/video-generation/` (with `provider-selector.ts`), and **optional** `domain/video/video.service.ts` for job orchestration only. This matches §9.3 and avoids domain importing low-level provider SDKs unless you later choose otherwise.

---

## 3. Route-by-Route Breakdown

### 3.1 `editor/index.ts` — 2,362 Lines → Target: ~300 Lines

This is the largest and most critical refactor.

**What's currently in the route file that must move:**

1. `buildFfmpegAtempoChain(speed: number): string` — Pure function. Move to `domain/editor/timeline/composition.ts`.

2. Timeline building pipeline (lines ~200–600) — Multiple DB queries + composition logic. Move to `domain/editor/timeline/timeline-builder.ts` as a service function.

3. Caption processing logic — Move to `domain/editor/captions/caption.service.ts`.

4. Export job creation and status checking — Move to `domain/editor/export/export.service.ts`.

5. All Drizzle queries — Move to `domain/editor/editor.repository.ts`.

**After refactoring, a representative route handler looks like:**

```typescript
// routes/editor/index.ts — after
editorRouter.post(
  "/projects/:projectId/clips",
  rateLimiter("customer"),
  authMiddleware("user"),
  csrfMiddleware(),
  validateBody(addClipSchema),
  async (c) => {
    const auth = c.get("auth");
    const { projectId } = c.req.param();
    const clipData = c.req.valid("json");

    const result = await editorService.addClip(auth.user.id, projectId, clipData);
    return c.json(result, 201);
  },
);
```

The route handler is 10 lines. All the work is in `editorService.addClip()`.

**Split `editor/index.ts` into sub-routers** (target names in the plan; **as implemented** the tree is):

```
routes/editor/
  index.ts                      ← mounts sub-routers only
  editor-projects.router.ts     ← project CRUD, init, publish, timeline save, …
  editor-export.router.ts       ← export jobs + status
  editor-fork-versions.router.ts
  editor-ai.router.ts           ← mounts editor-ai-assembly + editor-link-content
  editor-ai-assembly.router.ts
  editor-link-content.router.ts
  assets.router.ts
  captions.ts                   ← caption / transcribe (candidate to trim)
  export-worker.ts              ← worker-style handler (candidate for domain)
  zod-validation-hook.ts        ← shared zValidator 422 shape for editor
  services/                     ← refresh-editor-timeline, ai-assembly-prompt, assembly-presets, …
  export/                       ← e.g. ass-generator
  schemas.ts
```

A dedicated `timeline.router.ts` was folded into **projects** + **domain** timeline helpers (`domain/editor/timeline/`) rather than a separate route file.

### 3.2 `admin/index.ts` — 1,254 Lines → Target: ~200 Lines

Move all analytics aggregation, cost calculations, and customer management logic to `domain/admin/admin.service.ts`. All Drizzle queries to `domain/admin/admin.repository.ts`.

Split into sub-routers:
```
routes/admin/
  index.ts               ← mounts sub-routers
  customers.router.ts
  orders.router.ts
  analytics.router.ts
  costs.router.ts
  config.router.ts
```

### 3.3 `video/index.ts` — 1,230 Lines → Target: ~200 Lines

The video generation pipeline (provider selection, job creation, status polling, rendering) should move to `domain/video/video.service.ts` when that module is introduced. **Provider implementations** remain infrastructure: `services/video-generation/providers/` (see §9.3), selected via `provider-selector.ts`.

### 3.4 `queue/index.ts` — 1,061 Lines → Target: ~200 Lines

`deriveStages()` and the content iteration pipeline are pure orchestration logic that has no business being in a route handler. Move to:
- `domain/queue/pipeline/stage-derivation.ts`
- `domain/queue/pipeline/content-iteration.ts`

---

## 4. Service Layer Rules

### Rule 1: Services Live in `domain/`, Infrastructure Adapters Live in `services/`

The naming is now unambiguous:
- `domain/editor/editor.service.ts` — business logic for editing
- `services/storage/r2.ts` — R2 adapter (no domain knowledge)
- `services/tts/elevenlabs.ts` — ElevenLabs adapter (no domain knowledge)

Domain services call infrastructure services. Infrastructure services never import from `domain/`.

### Rule 2: Domain Services Depend on Repositories (Not on `db`)

Service functions take their dependencies as arguments or use constructor injection. They do not import the `db` singleton or call `redis` directly. They receive repositories.

```typescript
// WRONG — service imports db directly
import { db } from "../../services/db/db";
export async function getUser(id: string) {
  return db.select().from(users).where(eq(users.id, id));
}

// RIGHT — service receives repository
export class UserService {
  constructor(private users: UserRepository) {}
  async getUser(id: string) {
    return this.users.findById(id);
  }
}
```

Constructor injection also keeps dependencies explicit (and allows fakes or stubs later if you choose to add automated tests outside this reorg).

### Rule 3: Business Logic Functions Are Not Defined Inside Route Handlers

Any function that is more than 3 lines and performs a calculation, transformation, or decision must be extracted to a service or utility file with a descriptive name. Functions without names are hard to reuse and impossible to grep for.

### Rule 4: Each Service File Exports One Service

```typescript
// domain/editor/editor.service.ts
export class EditorService {
  constructor(
    private editorRepo: EditorRepository,
    private storage: StorageService,
    private timelineBuilder: TimelineBuilder,
  ) {}

  async getProject(userId: string, projectId: string): Promise<EditProject> { ... }
  async saveTimeline(userId: string, projectId: string, timeline: Timeline, expectedVersion: number): Promise<void> { ... }
  async initProject(userId: string, contentId: string): Promise<EditProject> { ... }
}

export const editorService = new EditorService(
  new EditorRepository(db),
  storageService,
  new TimelineBuilder(),
);
```

---

## 5. Repository Layer (New)

Repositories are the only layer that imports from the Drizzle schema. No route handler and no service function writes a Drizzle query directly.

### 5.1 What Goes in a Repository

- All `db.select()`, `db.insert()`, `db.update()`, `db.delete()` calls
- All `db.transaction()` calls
- Complex Drizzle joins (but no business decisions)
- Pagination helpers

### 5.2 What Does NOT Go in a Repository

- Business logic (a repository does not decide whether an operation is allowed)
- HTTP concerns
- External service calls (no S3, no Firebase, no Redis in a repository)

### 5.3 Interface Per Repository

Each repository implements an interface so call sites depend on a contract, not on Drizzle details.

```typescript
// domain/editor/editor.repository.ts

export interface IEditorRepository {
  findByUserAndContent(userId: string, contentId: string): Promise<EditProject | null>;
  findById(projectId: string): Promise<EditProject | null>;
  create(data: CreateEditProjectData): Promise<EditProject>;
  updateTimeline(projectId: string, tracks: Timeline, version: number): Promise<EditProject>;
  incrementVersion(projectId: string, expectedVersion: number): Promise<EditProject>;
  delete(projectId: string): Promise<void>;
}

export class EditorRepository implements IEditorRepository {
  constructor(private db: Database) {}

  async findByUserAndContent(userId: string, contentId: string): Promise<EditProject | null> {
    const [row] = await this.db
      .select()
      .from(editProjects)
      .where(
        and(
          eq(editProjects.userId, userId),
          eq(editProjects.generatedContentId, contentId),
          isNull(editProjects.parentProjectId), // root project only
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ...
}
```

### 5.4 Repositories for Every Table

| Table | Repository |
|---|---|
| `users` | `domain/auth/auth.repository.ts` |
| `userSettings` | `domain/users/users.repository.ts` |
| `orders` | `domain/customer/customer.repository.ts` |
| `generatedContent` | `domain/content/content.repository.ts` |
| `assets` | `domain/assets/assets.repository.ts` |
| `contentAssets` | `domain/content/content.repository.ts` (join table, belongs with content) |
| `reels` | `domain/reels/reels.repository.ts` |
| `reelAnalyses` | `domain/reels/reels.repository.ts` |
| `niches` | `domain/reels/reels.repository.ts` |
| `queueItems` | `domain/queue/queue.repository.ts` |
| `instagramPages` | `domain/queue/queue.repository.ts` |
| `projects` | `domain/chat/chat.repository.ts` |
| `chatSessions` | `domain/chat/chat.repository.ts` |
| `chatMessages` | `domain/chat/chat.repository.ts` |
| `messageAttachments` | `domain/chat/chat.repository.ts` |
| `editProjects` | `domain/editor/editor.repository.ts` |
| `exportJobs` | `domain/editor/export/export.repository.ts` |
| `musicTracks` | `domain/music/music.repository.ts` |
| `featureUsages` | `domain/users/users.repository.ts` |
| `systemConfig` | keep in `services/config/` — it's infrastructure |
| `contactMessages` | `domain/customer/customer.repository.ts` |

---

## 6. Type System Consolidation

### 6.1 Move Middleware Types Out of `middleware/protection.ts`

`HonoEnv`, `Variables`, `AuthResult`, `AdminAuthResult` are currently defined inside the middleware file. Every file that imports these types is coupled to the middleware module.

Move to `src/types/hono.types.ts` (implemented). The repo uses `AuthResult`, `Variables` (auth + `validatedBody` / `validatedQuery` / rate-limit headers), and `HonoEnv`:

```typescript
// src/types/hono.types.ts — illustrative; see file for full exports
export interface AuthResult {
  user: { id: string; email: string; role: string };
  firebaseUser: { uid: string; email: string; stripeRole?: string; /* … */ };
}

export type Variables = {
  auth: AuthResult;
  validatedBody: unknown;
  validatedQuery: unknown;
  rateLimitHeaders: Record<string, string>;
};

export type HonoEnv = { Variables: Variables };
```

### 6.2 Strict JSONB Types for Timeline State

`editProjects.tracks` is stored as JSONB and typed as `unknown` or `any`. This is the most dangerous untyped area in the codebase — the entire editor state flows through this column.

Create `src/types/timeline.types.ts` with the complete runtime shape, then validate on read:

```typescript
// src/types/timeline.types.ts
export interface Timeline {
  tracks: Track[];
  version: number;
  fps: number;
  durationMs: number;
}

export interface Track {
  id: string;
  type: "video" | "audio" | "text" | "caption";
  clips: Clip[];
  locked: boolean;
  muted: boolean;
}

export interface Clip {
  id: string;
  assetId: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  sourceMaxDurationMs: number;
  // ... full shape from frontend editor.types.ts
}
```

The repository's `findById` returns a `EditProject` with `tracks: Timeline`, validated via Zod on read:

```typescript
async findById(projectId: string): Promise<EditProject | null> {
  const [row] = await this.db.select().from(editProjects).where(eq(editProjects.id, projectId));
  if (!row) return null;
  // Validate JSONB at the boundary
  const tracks = timelineSchema.parse(row.tracks);
  return { ...row, tracks };
}
```

### 6.3 Consolidate Feature Types Into Domain Files

Every type defined inline in a route handler or scattered across `features/*/types/` moves to `domain/[feature]/[feature].types.ts`. The rule: if you're looking for the type of a `GeneratedContent`, you look in `domain/content/content.types.ts`.

Drizzle's inferred types (`InferSelectModel<typeof generatedContent>`) are the database layer types. Domain types may differ from DB types (e.g., a domain `EditProject` has `tracks: Timeline`, not `tracks: unknown`). The repository layer is the translation boundary.

---

## 7. Validation Consolidation

### Rule: All Routes Use `zValidator`

The manual validation approach (`const body = await c.req.json(); if (!x) return c.json(...)`) is deleted everywhere. Every route that accepts a body or query string uses `zValidator` from `@hono/zod-validator`.

```typescript
// BEFORE: manual validation
const body = await c.req.json();
const { sourceReelId, prompt } = body;
if (!sourceReelId || !prompt?.trim()) {
  return c.json({ error: "sourceReelId and prompt are required" }, 400);
}

// AFTER: zod validator middleware
const generateSchema = z.object({
  sourceReelId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
});

generationRouter.post(
  "/",
  zValidator("json", generateSchema),
  async (c) => {
    const { sourceReelId, prompt } = c.req.valid("json"); // fully typed
    // ...
  },
);
```

### Shared Schemas

Schemas used across multiple routes live in `src/validation/shared.schemas.ts`:

```typescript
// src/validation/shared.schemas.ts
export const uuidParam = z.object({ id: z.string().uuid() });
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const searchQuery = z.object({
  q: z.string().min(1).optional(),
});
```

Editor routes may use `zValidator(..., { hook: editorZodValidationHook })` from `routes/editor/zod-validation-hook.ts` so validation failures always return `{ error, code: "INVALID_INPUT", details }` per §8.1.

Feature-specific schemas live in `domain/[feature]/[feature].schemas.ts`:

```typescript
// domain/editor/editor.schemas.ts
export const saveTimelineSchema = z.object({
  tracks: z.array(trackSchema),
  expectedVersion: z.number().int().min(0),
});

export const addClipSchema = z.object({
  trackId: z.string().uuid(),
  assetId: z.string().uuid(),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(100),
  trimStartMs: z.number().int().min(0),
  trimEndMs: z.number().int().min(0),
});
```

---

## 8. Error Handling Standardization

### 8.1 One Error Shape

Every error response across the entire API follows this shape:

```typescript
interface ApiError {
  error: string;        // human-readable message
  code: string;         // machine-readable constant (SCREAMING_SNAKE_CASE)
  details?: unknown;    // optional, only for validation errors (Zod issue array)
}
```

Examples:
```json
{ "error": "User not found", "code": "USER_NOT_FOUND" }
{ "error": "Validation failed", "code": "INVALID_INPUT", "details": [...] }
{ "error": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED" }
{ "error": "Usage limit reached", "code": "USAGE_LIMIT_REACHED" }
{ "error": "Version conflict", "code": "VERSION_CONFLICT" }
```

### 8.2 `AppError` Class

Route handlers currently have `try/catch` blocks that return ad-hoc error responses. Replace with a typed error class that routes can throw and a central error handler that catches:

```typescript
// src/utils/errors/app-error.ts

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Pre-defined errors (static factory methods)
export const Errors = {
  notFound: (resource: string) =>
    new AppError(`${resource} not found`, "NOT_FOUND", 404),

  unauthorized: () =>
    new AppError("Authentication required", "AUTH_REQUIRED", 401),

  forbidden: (reason?: string) =>
    new AppError(reason ?? "Access denied", "FORBIDDEN", 403),

  usageLimitReached: () =>
    new AppError("Usage limit reached", "USAGE_LIMIT_REACHED", 403),

  versionConflict: () =>
    new AppError("Version conflict — refresh and try again", "VERSION_CONFLICT", 409),

  validationFailed: (details: unknown) =>
    new AppError("Validation failed", "INVALID_INPUT", 422, details),

  internal: (message = "Internal server error") =>
    new AppError(message, "INTERNAL_ERROR", 500),

  badRequest: (message: string, code = "BAD_REQUEST") =>
    new AppError(message, code, 400),

  conflict: (message: string, code = "CONFLICT") =>
    new AppError(message, code, 409),
};
```

### 8.3 Global error handler (implemented)

The app uses Hono’s **`app.onError`** callback, not a try/catch wrapper around every request. Implemented as `handleRouteError` in `middleware/error-handler.ts`:

```typescript
// src/middleware/error-handler.ts — shape
export const handleRouteError: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message, code: err.code };
    if (err.details !== undefined) body.details = err.details;
    // PROJECT_EXISTS: also surface existingProjectId at top level for clients
    // …
    return c.json(body, err.statusCode as ContentfulStatusCode);
  }
  debugLog.error("Unhandled error", { service: "error-handler", operation: "onError" }, err);
  return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
};
```

Register in `index.ts`: `app.onError(handleRouteError)`. Handlers can `throw` `AppError` / `Errors.*` instead of returning ad-hoc JSON for expected failures.

### 8.4 Remove try/catch From Routes

After adding the global error handler, route handlers become:

```typescript
// BEFORE
editorRouter.get("/:projectId", async (c) => {
  try {
    const auth = c.get("auth");
    const project = await editorService.getProject(auth.user.id, c.req.param("projectId"));
    if (!project) return c.json({ error: "Not found" }, 404);
    return c.json(project, 200);
  } catch (err) {
    debugLog.error("Failed to get project", {}, err);
    return c.json({ error: "Failed to get project" }, 500);
  }
});

// AFTER
editorRouter.get("/:projectId", async (c) => {
  const auth = c.get("auth");
  const project = await editorService.getProject(auth.user.id, c.req.param("projectId"));
  return c.json(project, 200);
  // editorService.getProject throws Errors.notFound() if project doesn't exist
  // global handler catches it
});
```

---

## 9. Infrastructure Consolidation

### 9.1 Flatten `services/` — Keep Infrastructure Adapters Only

After domain logic moves to `domain/`, `services/` contains only infrastructure adapters with no business knowledge:

```
services/
  config/        ← SystemConfigService (reads/writes systemConfig table)
  csrf/          ← CSRF token generation + validation
  db/            ← db.ts (postgres connection), redis.ts (redis connection)
  email/         ← Resend adapter (send, templates)
  firebase/      ← Firebase admin init, user sync, Stripe integration
  observability/ ← metrics, structured logging
  rate-limit/    ← Redis rate limiter
  scraping/      ← Instagram scraping client
  storage/       ← R2 upload/download/delete
  timezone/      ← timezone utilities
  tts/           ← ElevenLabs TTS adapter
```

**Decision:** Keep provider modules under `services/video-generation/providers/`. They are third-party HTTP/SDK adapters. **Which** provider to run for a job is business logic and lives in `provider-selector.ts` (and eventually in `domain/video/video.service.ts` if you centralize orchestration there). This replaces the earlier idea of moving raw provider files into `domain/`.

### 9.2 Firebase Auth Sync

Firebase user sync orchestration lives in `domain/auth/` (`auth.service`, `firebase-user-sync.ts`). The Firebase Admin SDK (`adminAuth`, etc.) stays under `services/firebase/`.

Split:
- `services/firebase/admin.ts` — SDK initialization (unchanged)
- `services/firebase/verify.ts` — token verification only
- `domain/auth/auth.service.ts` — user upsert, role sync, first-login logic

### 9.3 Video Generation Providers

Currently in `services/video-generation/providers/` (relocated from `services/media/video-generation/`):
- `kling-fal.ts` (334 lines)
- `runway.ts` (155 lines)
- `image-ken-burns.ts` (196 lines)

These are AI provider adapters — they're closer to infrastructure than domain. Keep them in `services/` but rename the path:

```
services/video-generation/
  providers/
    kling.ts
    runway.ts
    ken-burns.ts
  provider-selector.ts    ← picks provider based on asset type / config
```

`domain/video/video.service.ts` imports `provider-selector.ts` and calls the right provider.

---

## 10. Dead Code to Delete

Verify each with grep before deleting.

| File / Pattern | Reason |
|---|---|
| `src/features/*/` directories | After `domain/` is created, the `features/` type files are absorbed. Delete the old directory. |
| Any inline `buildFfmpegAtempoChain()` definition in route handler | Extract to `domain/editor/timeline/`, then delete the inline version |
| Any inline `deriveStages()` in route handler | Extract to `domain/queue/pipeline/`, then delete the inline version |
| Manual `c.req.json()` + `if (!field)` validation blocks | Replace with `zValidator`, delete manual blocks |
| Duplicate `AuthResult` definition in `middleware/protection.ts` (if also in `features/auth/types.ts`) | Consolidate to `types/hono.types.ts`, delete duplicates |
| `src/shared/` utilities that are now in `domain/` or `services/` | Audit after reorganization |
| `debugLog.info()` calls that log "request received" or "starting operation" with no diagnostic value | Delete — they're noise in production logs |

---

## 11. Migration Sequence

These are ordered so each step builds on the previous and can be shipped independently.

### Phase 1: Foundation — No Behavior Changes

These changes are purely structural and do not touch business logic.

1. **Create `src/types/hono.types.ts`** — move `HonoEnv`, `Variables`, `AuthResult` here. Update all imports. `middleware/protection.ts` now imports from `types/` instead of defining them.

2. **Create `src/utils/errors/app-error.ts`** — define `AppError` and `Errors` factory. Register **`app.onError(handleRouteError)`** in `index.ts`. Do not change every existing try/catch yet.

3. **Create `src/validation/shared.schemas.ts`** — define `uuidParam`, `paginationQuery`, `searchQuery`. Replace any manually written instances of these with imports.

4. **Create `src/types/timeline.types.ts`** — strict TypeScript types for `Timeline`, `Track`, `Clip`. Do not enforce at runtime yet.

### Phase 2: Repository Layer

5. **Create `domain/` directory.** Start with `domain/auth/auth.repository.ts` (user upsert, findByFirebaseUid) since it's called on every single request.

6. **Create repositories for the 5 most-queried tables:** `users`, `editProjects`, `generatedContent`, `assets`, `queueItems`. Each repository wraps the existing Drizzle queries from wherever they currently live.

7. **Create domain services for these 5 areas.** Each service receives a repository, wraps existing logic, calls the repository instead of Drizzle directly.

8. **Update route handlers one at a time** to call the domain service instead of inline Drizzle. This is the most labor-intensive phase — do it incrementally.

### Phase 3: Route Shrinkage — Editor and Admin

9. **Tackle `editor/index.ts`** first. Extract `buildFfmpegAtempoChain()` and all timeline building into `domain/editor/timeline/`. Split into sub-routers. Target: each sub-router file < 200 lines.

10. **Tackle `admin/index.ts`** next. Extract analytics + cost calculations to `domain/admin/admin.service.ts`. Split into sub-routers.

11. **Tackle `queue/index.ts`** and `video/index.ts`.

### Phase 4: Validation Standardization

12. **Replace all manual `c.req.json()` validation** with `zValidator`. Start with routes that have the most fields (editor, generation). Create feature schema files in `domain/*/[feature].schemas.ts`.

13. **Add Zod validation for JSONB timeline data** — validate the `tracks` column on every read from `editProjects`. Start throwing on malformed data in staging first. This will reveal any existing corrupt data.

### Phase 5: Error Handling

14. **Convert services to throw `AppError`** instead of returning null/undefined for not-found cases.

15. **Remove try/catch from route handlers** one route at a time, relying on the global error handler. Verify behavior manually or in staging as you go.

### Phase 6: Infrastructure Cleanup

16. **Video generation providers** — keep under `services/video-generation/providers/`; **`provider-selector.ts`** owns selection (✅). Optional: introduce thin `domain/video/video.service.ts` for job orchestration only.

17. **Auth / Firebase** — session establishment and upsert logic live in **`domain/auth/auth.service.ts`** + **`domain/auth/auth.repository.ts`** (✅ partial). Bulk Auth alignment uses **`auth.repository.listUsersWithFirebaseUid`** + **`authService.syncAllFirebaseUsers`** (**`firebase-user-sync`** no longer queries Postgres). Remaining: trim any duplicate sync paths in `services/firebase/` until verify-only + admin SDK remain per §9.2.

18. **Audit and delete dead code** identified in section 10.

### Implementation status (repo snapshot) — updated

**Phase 1 (foundation):** `types/hono.types.ts`, `AppError` + global `handleRouteError` in `middleware/error-handler.ts` (including **`PROJECT_EXISTS`**: top-level `existingProjectId` + `code` for frontend compatibility), `validation/shared.schemas.ts`, `types/timeline.types.ts`.

**Phase 2 (repositories) — progress:**

- **`domain/editor/editor.repository.ts`** — Large surface: list/create/patch meta, fork/restore/snapshot flows, link-blank-project transaction (`generated_content` + `edit_project` + `queue_item`), export job helpers, timeline-merge transaction helpers (`resolveContentParentIdChainInTx`, `lockRootEditProjectForContentChainInTx`, `setProjectTracksInTx`, **`refreshEditorTimeline`**), export-status lookups for queue detail (`findLatestExportStatusForRootProjectByContentId`, `findLatestDoneExportOutputR2ForRootProjectByContentId`), etc.
- **`domain/queue/queue.repository.ts`** — includes `markDraftOrScheduledReadyByContent` (publish path), **queue list page** (`listQueueItemsPage` + asset/root/version batch queries), **create draft** (`createDraftQueueItemAndMarkContentQueued`), and **items CRUD/detail** helpers (`duplicateQueueItemForUser`, `deleteQueueItemForUser`, etc.).
- **`domain/queue/queue.service.ts`** — **`listQueueItemsPage`**, **`createDraftQueueItem`** (maps `QueueChainError` → `AppError`), **`getQueueItemDetail`**, **`duplicateQueueItem`**, **`updateQueueItem`** / **`deleteQueueItem`** (transition rules in **`queue-transitions.ts`**).
- **`domain/content/content.repository.ts`** — `findIdAndHookForUser` includes `parentId` (editor create flow); **`resolveContentAncestorChainIds`** replaces the old `resolveContentChainIds` helper (parent walk for root-project uniqueness). **`findOwnedGeneratedContentId`** + **`insertContentAssetLink`** support **`POST /api/assets/upload`** without route-level Drizzle. **`insertGeneratedVideoClipAndLink`** + **`replaceGeneratedVideoClipForShot`** back **`routes/video/reel-job-runner.ts`** (phase-4 / shot regenerate). **`resolveGeneratedContentChainTip`** (exported) is the single implementation for chain-tip walks; **`domain/queue/pipeline/content-chain.ts`** re-exports **`resolveChainTip(startId, userId, database)`**. **`listVideoClipAssetsForAiAssembly`** backs **`loadProjectShotAssets`** in **`domain/editor/timeline/ai-assembly-tracks.ts`** (no direct Drizzle there).
- **`domain/content/content.service.ts`** — **`createUserUploadForGeneratedContent`** (owns **`assetsRepository.insertAsset`** + content link); wired from **`singletons`** with **`assetsRepository`**.
- **`domain/admin/admin.repository.ts` / `admin.service.ts`** — batch-1 additions: DB ping, dynamic table page/count (admin schema export), Firebase UID user lookup, monthly generation usage count, niche scrape job insert, platform music create + delete (track + asset), used by **`routes/admin/*`** and subscriptions list enrichment.
- **`domain/editor/editor.service.ts`** — includes **`createEditorProject`** (pre-check + `buildInitialTimeline` + insert + `23505`), **`syncNewAssetsIntoProject`**; list/get/patch/delete/publish/new-draft/thumbnail as before. **`routes/editor/editor-projects.router.ts`** is a thin mount (~**200 lines**).
- **`domain/editor/build-initial-timeline.ts`** — `buildInitialTimeline(contentRepo, …)`, **`composeOverlayText`**; uses **`content.findHookAndVoiceoverForUser`** + **`listAssetsLinkedToGeneratedContent`** + **`mergePlaceholdersWithRealClips`** from **`timeline/merge-placeholders-with-assets.ts`**.
- **`domain/editor/merge-new-assets.ts`** — `mergeNewAssetsIntoProject(editor, content, …)` (no route singletons).
- **`domain/editor/timeline/merge-placeholders-with-assets.ts`** — `mergePlaceholdersWithRealClips`, `reconcileVideoClipsWithoutPlaceholders`, track/asset types; **`routes/editor/services/refresh-editor-timeline.ts`** re-exports merge helpers and delegates **`refreshEditorTimeline`** to **`editorRepository`**.
- **`domain/assets/assets.repository.ts`** — `findR2FieldsByIdForUser` (export status output asset, user-scoped); **`findByIdForUser`**, **`findManyByIdsForUser`**, **`insertAsset`** (export output + captions asset reads).
- **`domain/editor/captions.repository.ts`** — `findByAssetAndUser`, `insert`; **`captions.service.ts`** — Whisper + R2 + repos, **`AppError` / `Errors`**; **`singletons`** wires **`captionsService`**.
- **`domain/editor/run-export-job.ts`** — full FFmpeg pipeline; **`export/ass-generator.ts`** (ASS presets); **`routes/editor/export-worker.ts`** delegates with **`editorRepository.updateExportJob`** + **`assetsRepository`**.
- **`routes/editor/captions.ts`** — thin (**~50 lines**): **`zValidator`** + **`captionsService`**.
- **`domain/music/music.repository.ts`** — library list + count, content ownership check, active track + asset join, replace **`background_music`** on **`content_asset`**; **`music.service.ts`** — presigned preview URLs, **`attachMusicToContent`** (**`Errors.notFound`**); **`routes/music/index.ts`** has no **`db`** (**`musicService`** from **`singletons`**; editor refresh via dynamic import).
- **`domain/audio/audio.repository.ts`** — trending reel/audio aggregates, content ownership, voiceover **`content_asset`** + **`asset`** read/delete/link; **`audio.service.ts`** — trending mapping, voice catalog URLs, TTS pipeline (**`assetsRepository.insertAsset`**, R2, ElevenLabs, cost ledger); **`routes/audio/index.ts`** has no **`db`** (**`AppError`** rethrow + legacy **`TTS_PROVIDER_ERROR`** JSON shape preserved).
- **`domain/reels/reels.repository.ts`** — usage counts, niches, filtered list + totals, analysis id sets (**`inArray`**), bulk/detail/export viral queries; **`reels.service.ts`** — dashboard payload, presigned media (**`AppError`** for missing reel/video), CSV/JSON export, **`analyzeReel`** + usage.
- **`domain/public/public.repository.ts`** — paginated **`contact_message`** list + insert; **`public.service.ts`** — decrypt for admin list, encrypt + spam heuristics on create (**`AppError`**); **`routes/public/index.ts`** has no **`db`** for contact routes (email + upload handlers unchanged).
- **`domain/queue/queue-editor-join.ts`** — shared `rootEditProjectJoinQueueItems` for queue list `LEFT JOIN` to root edit project.
- **Still not done:** Under **`src/routes/`**, only **`health/index.ts`** imports **`db`**. **`singletons.ts`** is the only other **`src/**`** file that opens **`db`** (constructs repositories). **§4 Rule 2** (constructor injection everywhere) is **partial** — some services/repos are still wired ad hoc. **Automated tests are out of scope** for this document (see **§11 — Scope**).

**Phase 3 (route shrinkage):**

- **Editor** — `routes/editor/index.ts` is a thin mount. **AI:** split into `editor-ai.router.ts` (mount only), `editor-ai-assembly.router.ts` (~185 lines), `editor-link-content.router.ts`. **Shared:** `routes/editor/zod-validation-hook.ts`. **Projects / fork / export / link** delegate heavily to `editorRepository`.
- **Timeline domain:** `domain/editor/timeline/clip-trim.ts` (`normalizeMediaClipTrimFields`), `ai-assembly-tracks.ts`, existing `composition.ts` (FFmpeg chain).
- **Still large / not fully extracted:** **Editor projects** router can still grow with new routes; **captions / export-worker** are thin (logic in **`captions.service`** / **`run-export-job`**). **`lib/chat-tools.ts`** delegates to **`chatToolsRepository`** (no route-level Drizzle). **`usage-gate`** / **`recordUsage`** → **`customerRepository`**; **`cost-tracker`** → **`adminRepository.insertAiCostLedgerRow`**; **`queue-chain-guard`** is typed on **`AppDb`** only. **Queue:** thin routers + **`queueService`**.

**Phase 4 (validation):**

- **`zValidator`** on body/query/param for the areas called out earlier; form-data (e.g. thumbnails) stays manual where needed.
- **Feature schemas** live under `domain/<feature>/*.schemas.ts` for many domains; not every handler is co-located.
- **JSONB `tracks`:** `parseStoredEditorTracks` is used on **GET** `/api/editor/:id`, **export-worker**, **refresh-editor-timeline** (merge path), **merge-new-assets**, **fork / restore**, **new-draft**. **`clipDataSchema`** includes placeholder fields so Zod does not strip `isPlaceholder` / `placeholderShotIndex` / etc.

**Phase 5 (errors):**

- **Editor:** many handlers use **`throw Errors.*` / `AppError`** and dropped broad `try/catch` (e.g. projects list, patch, thumbnail, delete, sync, publish, new-draft, fork, restore, link). **POST `/api/editor`** (create project) keeps **`try/catch` only for Postgres `23505`** (unique root per content) then rethrows `AppError` **`project_exists`**.
- **Elsewhere:** **customer**, **users**, **generation**, **chat**, **subscriptions**, **admin**, **video** workers, **auth**, and many handlers still mix manual `c.json` errors with throws.

**Phase 6 (infrastructure):**

- **`services/video-generation/provider-selector.ts`** — `getVideoGenerationProvider` + provider map; **`services/video-generation/index.ts`** — `generateVideoClip` + **`recordMediaCost`** via **`adminRepository.insertAiCostLedgerRow`** (no local Drizzle handle).
- **`services/firebase/sync.ts`** — **removed**; import **`FirebaseUserSync`** from **`domain/auth/firebase-user-sync.ts`**; bulk align uses **`authService.syncAllFirebaseUsers()`**.
- **`services/` = adapters only**, full **§10** dead-code pass, optional **`domain/video/video.service.ts`** — **not done**.

---

### Remaining work (full backlog vs target summary checklist)

Use this as the authoritative gap list; verify with grep/tree before picking up an item.

#### Scope

| In scope (this doc) | Out of scope |
|---------------------|--------------|
| Directory layout, repositories, thin routes, validation, **`AppError`** / global handler coverage, **`services/`** cleanup, §10 dead-code passes | **Automated unit tests**, **integration tests**, and **mandatory repository mocks** — not part of this reorg backlog; track under your testing roadmap if needed |

Constructor injection and repository interfaces remain **architectural goals** for clarity and swapability; they are **not** gated on adding tests.

#### Leftover work (in scope — snapshot)

What is still open after the latest repo snapshot (details in the phase checklists below):

1. **Phase 2 — Wiring:** Finish **constructor injection** for domain services that still rely on implicit globals or partial wiring; keep **`singletons.ts`** as the single composition root.
2. **Phase 3 — Routes:** Split **admin** and **video** monoliths; move analytics, costs, and job pipelines further into **`domain/admin`** and (optionally) **`domain/video`**.
3. **Phase 4 — Validation:** Optional form-data helpers; align schema file naming (**§7**); policy for **`tracks`** / queue list JSON (**parse** vs document-as-untrusted).
4. **Phase 5 — Errors:** Replace manual **`c.json({ error: … })`** with **`throw AppError` / `Errors.*`** across remaining routes; prefer throw in domain for not-found/rules; audit legacy client shapes vs **§8.1**.
5. **Phase 6 — Infrastructure:** Flatten **`services/`** per **§9.1**; optional **`domain/video/video.service.ts`**; trim **`services/firebase`** to verify + admin SDK; **§10** dead-code deletion.

Optional: **`routes/health`** may delegate DB ping to a tiny repository helper for symmetry with the rest of the stack.

#### Phase 2 — Repository layer

- [x] **Queue list query:** `queueRepository.listQueueItemsPage` + **`queueService.listQueueItemsPage`** (`deriveStages`, asset counts, root/version batch SQL); **`routes/queue/core.router.ts`** validates and delegates.
- [x] **Queue item detail + CRUD:** `queueRepository` + **`queueService`** (`getQueueItemDetail`, duplicate, patch, delete); **`routes/queue/items.router.ts`** is thin.
- [x] **Editor captions / export worker:** **`captions.repository`**, **`captions.service`**, **`run-export-job`** + **`export/ass-generator`**; **`captions.ts`** / **`export-worker.ts`** are thin wrappers wired from **`singletons`**.
- [x] **Music (`routes/music`):** **`musicRepository`** + **`musicService`**; no **`db`** in the router.
- [x] **Audio (`routes/audio`):** **`audioRepository`** + **`audioService`** (uses **`assetsRepository`** for TTS inserts); no **`db`** in the router.
- [x] **Reels (`routes/reels`):** **`reelsRepository`** + **`reelsService`** (usage, niches, list/bulk/detail/media-url, export, analyze + **`customerRepository.insertFeatureUsage`** for reel analysis); no **`db`** in the router. **`GET /export`** is registered **before** **`GET /:id`** so export is reachable.
- [x] **Public / shared (`routes/public`):** **`publicRepository`** + **`publicService`** for **`contact-messages`** (GET list + POST create); no **`db`** in that router.
- [ ] **Inject repositories into domain services** (constructors / factories); routes and **`singletons.ts`** wire instances (**§4** Rule 2).
- [x] **Non-route Drizzle:** **`domain/config/config.repository.ts`** backs **`SystemConfigService`** / **`UserSettingsService`** and **`config-seed`** (wired from **`singletons`**). **`jobs/daily-scan.ts`** uses **`adminRepository.listActiveNichesForDailyScan()`**. **`domain/chat/chat-tools.repository.ts`** holds all chat-tool SQL; **`lib/chat-tools.ts`** delegates to **`chatToolsRepository`** from **`singletons`**.

**Routes under `src/routes/` importing `services/db/db` (verify: `rg 'services/db/db' src/routes` from `backend/`):**

| Path | Notes |
|------|--------|
| `routes/health/index.ts` | **Only remaining route** — Postgres (and Redis) health checks; **`db`** import is intentional. Optional later: delegate ping to **`authRepository.pingUsersTable()`**-style helper for symmetry. |

All other route modules listed in earlier revisions (**`auth`**, **`chat`**, **`customer`**, **`users`**, **`generation`**, **`subscriptions`**, **`projects`**, **`assets`**, **`video/*`**, **`admin/*`**, **`editor/*`** except health) **no longer** import **`services/db/db`** as of this doc refresh.

**Non-route `db` imports** (verify: `rg 'services/db/db' src` from `backend/`):

| Area | Files |
|------|--------|
| Wiring | `domain/singletons.ts` (sole **`db`** holder for constructing repositories) |
| Intentional | `routes/health/index.ts` (health checks) |

**Config / chat-tool consumers** import **`systemConfigService`**, **`userSettingsService`**, and **`chatToolsRepository`** from **`domain/singletons`** (not from `services/config/*` singleton exports — those files export **classes** only).

#### Phase 3 — Route size & domain logic

- [x] **Shrink `editor-projects.router.ts`:** **`editorService`** owns all project routes including **POST /** (`createEditorProject`) and **sync-assets** (`syncNewAssetsIntoProject`). **`build-initial-timeline`** / **`merge-new-assets`** live under **`domain/editor/`**; placeholder merge logic under **`domain/editor/timeline/merge-placeholders-with-assets.ts`**.
- [x] **Caption + transcribe routes** — **`captions.ts`** is under **~200 lines**; OpenAI / storage orchestration in **`captions.service`**.
- [ ] **Admin / video monoliths** — continue splitting routers and moving analytics, costs, job pipelines into **`domain/admin`**, **`domain/video`**, per original **§3** table.

#### Phase 4 — Validation

- [ ] **Form-data** — optional shared helpers or small Zod preprocess for multipart fields where it improves consistency.
- [ ] **Schema file naming** — align remaining routes with **`domain/<feature>/<feature>.schemas.ts`** only (**§7**).
- [ ] **Any code path that reads `tracks` from DB** — grep `editProjects` / `.tracks`; ensure **`parseStoredEditorTracks`** (or equivalent) at the boundary; **queue list** currently returns **`editProjectTracks`** from SQL — consider validating before encode or document as “untrusted until client GET editor”.

#### Phase 5 — Error handling

- [ ] **Customer, users, chat, generation, admin, video, auth, assets, subscriptions, etc.** — replace `return c.json({ error: ... }, nnn)` with **`throw new AppError(...)`** / **`Errors.*`**; remove defensive `try/catch` where the global handler suffices. (**Queue** / **editor** slices already lean on throws in many handlers.)
- [ ] **Domain services** — prefer **throw** over **null + branch** for not-found and business rule failures (**§8**).
- [ ] **Guarantee `{ error, code, details? }`** on every error path (**§8.1**); audit clients for legacy shapes.

#### Phase 6 — Infrastructure & cleanup

- [ ] **`services/` layout (**§9.1**)** — flatten to config, csrf, db, email, firebase, observability, rate-limit, scraping, storage, timezone, tts, **video-generation**; evict embedded business rules into **`domain/`**.
- [ ] **Video (**§3.3**, **§9.3**)** — optional **`domain/video/video.service.ts`** wrapping **`getVideoGenerationProvider`** + **`generateVideoClip`**; admin/customer “provider registry” could import a single **`services/video-generation/provider-registry.ts`** instead of duplicating dynamic imports.
- [ ] **Firebase sync (**§9.2**)** — business rules in **`domain/auth/auth.service.ts`**; **`services/firebase`** keeps verify + admin SDK only.
- [ ] **§10 Dead code** — grep for legacy `src/features/` under backend, duplicate types, noisy `debugLog`, unused helpers; delete after confirmation.

#### Target summary (**§ “Summary: What This Changes”**) — checklist

| Goal | Status |
|------|--------|
| Route files **&lt; ~200 lines** each | **Partial** — **captions**, **export-worker**, **music**, **audio**, **reels**, **public** (contact) are thin; **editor** AI assembly ~OK; **projects**, **queue** core OK; **customer**, **users**, **chat**, **generation**, **admin**, **video** workers, **assets**, **subscriptions** often still large. |
| **All Drizzle in repositories** | **Strong** — **All `src/routes/*` except `health`** avoid **`db`**; **`lib/chat-tools`**, **`jobs/daily-scan`**, and **`services/config/*`** use **`domain/*` repositories**; **`singletons`** alone imports **`db`** to construct repos (see **§11 non-route table**). |
| **Business logic in `domain/` services** | **Partial** — orchestration lives in **`domain/`** for the slices above; **customer**, **users**, **chat**, **generation**, **admin**, **video** pipelines, **auth**, **assets** route still mix HTTP + SQL. |
| **Bodies/query/params via `zValidator`** | **Done** (except intentional form-data gaps). |
| **Timeline JSONB validated on read** | **Strong for editor pipeline**; queue list exposes tracks without parse — **decide policy**. |
| **Types in `domain/*/types`** | **Partial**. |
| **One error shape + global handler** | **Wired**; **coverage** still incomplete across routes. |
| **Video provider selection explicit** | **`provider-selector.ts`** done; **domain video service** optional. |
| **Automated tests (unit / integration)** | **Out of scope** for this reorg doc — see **§11 → Scope**. |

---

## 12. Appendix: Current layout, decisions, verification

### 12.1 Resolved decisions (plan vs repo)

| Topic | Decision |
|--------|-----------|
| Video provider modules | Stay in **`services/video-generation/`**; selection in **`provider-selector.ts`**. |
| `domain/video/` | Reserved for orchestration/repository/types — not for raw FAL/Runway client files unless you intentionally move them later. |
| Global errors | **`handleRouteError`** on **`app.onError`**; body `{ error, code, details? }` plus **`existingProjectId`** for **`PROJECT_EXISTS`**. |
| Editor validation hook | **`routes/editor/zod-validation-hook.ts`** aligns editor Zod failures with §8.1. |
| Stored timeline JSONB | **`parseStoredEditorTracks`** / **`validate-stored-tracks`** (and related) at repository or service boundaries for editor flows; queue list may still expose raw JSON — see remaining-work checklist. |

### 12.2 Domain modules present today (`backend/src/domain/`)

Use this as a quick map when navigating the partial migration:

| Area | Notable files |
|------|----------------|
| Auth | `auth.service.ts`, `auth.repository.ts`, `firebase-user-sync.ts` |
| Customer | `customer.service.ts`, `customer.repository.ts`, `customer.schemas.ts` (usage insert, profile, orders, etc.) |
| Chat | `chat.service.ts`, `chat.repository.ts`, **`chat-tools.repository.ts`** (AI tool SQL); **`lib/chat-tools.ts`** delegates to **`chatToolsRepository`** |
| Config | **`config.repository.ts`** — system config rows + user settings; **`services/config/*`** are HTTP-free service classes (instances from **`singletons`**) |
| Admin | `admin.service.ts`, `admin.repository.ts`, `admin.schemas.ts` |
| Editor | `editor.repository.ts`, `editor.service.ts`, `editor.schemas.ts`, `validate-stored-tracks.ts`, `run-export-job.ts`, `captions.repository.ts`, `captions.service.ts`, `export/ass-generator.ts`, `timeline/*`, `build-initial-timeline.ts`, `merge-new-assets.ts` |
| Queue | `queue.repository.ts`, `queue.service.ts`, `queue.schemas.ts`, `queue-transitions.ts`, `queue-editor-join.ts`, `pipeline/stage-derivation.ts`, `pipeline/content-chain.ts`, `pipeline/asset-display.ts` |
| Content / assets | `content.repository.ts`, `content.service.ts`, `assets.repository.ts`, `assets.service.ts`, plus `*.schemas.ts` for several domains |
| Reels | `reels.repository.ts`, `reels.service.ts`, `reels.schemas.ts` |
| Music / audio | `music.repository.ts`, `music.service.ts`, `music.schemas.ts`; `audio.repository.ts`, `audio.service.ts`, `audio.schemas.ts` |
| Public | `public.repository.ts`, `public.service.ts`, `public.schemas.ts` |
| Wiring | `singletons.ts` — central place to see how services/repos are constructed |

Schemas exist for many domains (`music`, `audio`, `video`, `customer`, `users`, `public`, `analytics`, `reels`, `subscriptions`, `content`, …). **Customer** and **chat** have **`domain/*/repository` + `service`** wired from routes; **users**, **generation**, and **subscriptions** still mix larger HTTP layers with partial domain extraction (see **§11 Remaining work**).

### 12.3 Verification commands

Run from `backend/` when scoping remaining work:

```bash
# Routes: only health should import db when route-layer Drizzle is “done”
rg 'services/db/db' src/routes

# Full src (singletons, lib, jobs, config services still legitimate)
rg 'services/db/db' src

# editProjects / tracks reads (validation policy audit)
rg 'editProjects|\.tracks' src/routes src/domain

# Manual error responses vs throws
rg 'c\.json\(\s*\{\s*error:' src/routes
```

### 12.4 How to read this document

- **§1–§10** — Target architecture and rules (the north star).
- **§11** — **Scope** (tests out of scope), **leftover work** snapshot, ordered migration phases, **implementation status** (living), checklists, and **target summary** table.
- **Summary (end of document)** — Target end-state checklist; pair it with §11 for what is already shipped vs still open.

### 12.5 Related docs

- Root **`CLAUDE.md`** — day-to-day backend commands and stack (Hono, Drizzle, editor conventions).
- **`CONTRIBUTING.md`** — points to architecture docs under `docs/AI_Orchestrator/` when that tree is present in the repo.

---

## Summary: What this changes (target end state)

**Ground truth for what is already done vs in flight:** see **§11 — Implementation status**, **Remaining work**, and **Target summary** table.

When the reorganization is **fully** complete:

- **Routes are &lt; ~200 lines** each — they validate, delegate, respond
- **All Drizzle queries live in repositories** — changing a column touches one file
- **Business logic is in `domain/` services** — callable without HTTP concerns; persistence only via repositories
- **One error shape** across the entire API — `{ error, code, details? }` (plus documented client-compat fields where needed)
- **All routes use `zValidator`** (or thin wrappers) — no untyped JSON bodies for structured inputs
- **JSONB timeline state is strictly typed and validated at runtime** — no silent timeline corruption
- **Video provider selection is explicit** — `provider-selector` + optional `domain/video` orchestration
- **Feature types are co-located with domain logic** — e.g. `domain/editor/editor.types.ts`, not scattered `features/*/types/`

The end state replaces monolithic route files (thousands of lines mixing FFmpeg, SQL, and HTTP) with small route modules and single-purpose domain files.
