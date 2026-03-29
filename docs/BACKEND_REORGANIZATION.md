# Backend Reorganization Plan

> **Scope:** `backend/src/` — full structural overhaul for long-term maintainability.
> **Backwards compatibility:** Not a concern. All internal structure is fair game.
> **Goal:** Routes that are thin HTTP adapters. Services that contain all business logic. Repositories that own all database access. A structure where adding a feature means adding one file in a predictable place, not hunting across 4 directories.

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
- Writing tests for service logic requires either hitting a real database or mocking Drizzle directly
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

These are pure functions. They should be in service/utility files with tests.

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
│       ├── video.service.ts
│       ├── video.repository.ts
│       ├── providers/
│       │   ├── kling.provider.ts
│       │   ├── runway.provider.ts
│       │   └── ken-burns.provider.ts
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
│   ├── editor/index.ts       ← target: <300 lines (split into sub-routers)
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
│   └── tts/                  ← ElevenLabs TTS
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

**Key structural decision:** `domain/` is new. It separates business logic from infrastructure services. The rule is:
- `domain/` knows about the database schema (via repositories) and calls infrastructure services (email, storage, TTS)
- `services/` knows about external systems (Firebase, Redis, Resend, R2) and provides adapters
- `routes/` knows about HTTP only

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

**Split `editor/index.ts` into sub-routers:**

```
routes/editor/
  index.ts            ← mounts sub-routers
  projects.router.ts  ← CRUD for editor projects
  timeline.router.ts  ← clip/track operations
  export.router.ts    ← export job management
  captions.router.ts  ← caption operations (already partially extracted)
```

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

The video generation pipeline (provider selection, job creation, status polling, rendering) moves to `domain/video/video.service.ts`. Provider-specific logic already exists as separate files under `services/media/video-generation/providers/` — move them to `domain/video/providers/`.

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

### Rule 2: Service Functions Are Testable in Isolation

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

This makes unit tests trivial: pass a mock repository, no database needed.

### Rule 3: Business Logic Functions Are Not Defined Inside Route Handlers

Any function that is more than 3 lines and performs a calculation, transformation, or decision must be extracted to a service or utility file with a descriptive name. Functions without names are untestable and unsearchable.

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

Each repository implements an interface. This is what makes mocking in tests possible.

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

Move to `src/types/hono.types.ts`:

```typescript
// src/types/hono.types.ts
export interface AuthVariables {
  auth: {
    user: { id: string; email: string; role: string };
    firebaseUser: { uid: string; email: string; stripeRole?: string };
  };
}

export type HonoEnv = { Variables: AuthVariables };
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
};
```

### 8.3 Global Error Handler Middleware

```typescript
// src/middleware/error-handler.ts

export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        return c.json(
          { error: err.message, code: err.code, details: err.details },
          err.statusCode as StatusCode,
        );
      }
      // Unexpected error
      debugLog.error("Unhandled error", { service: "error-handler" }, err);
      return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
    }
  };
}
```

Register on the root app in `index.ts`. Now every route handler can `throw Errors.notFound("User")` instead of returning a JSON response, and try/catch blocks largely disappear from routes.

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

Move `services/media/video-generation/providers/` to `domain/video/providers/` — provider selection is business logic, not an infrastructure concern.

### 9.2 Firebase Auth Sync

`services/firebase/sync.ts` (311 lines) syncs Firebase users to Postgres. This is currently called inside `authMiddleware`. The sync logic is business logic (determining the right role, handling first login, updating DB) and belongs in `domain/auth/auth.service.ts`. The Firebase admin SDK call (`adminAuth.verifyIdToken()`) stays in `services/firebase/`.

Split:
- `services/firebase/admin.ts` — SDK initialization (unchanged)
- `services/firebase/verify.ts` — token verification only
- `domain/auth/auth.service.ts` — user upsert, role sync, first-login logic

### 9.3 Video Generation Providers

Currently in `services/media/video-generation/providers/`:
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

2. **Create `src/utils/errors/app-error.ts`** — define `AppError` and `Errors` factory. Add `errorHandler()` middleware to `index.ts`. Do not change any existing try/catch yet.

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

13. **Add Zod validation for JSONB timeline data** — validate the `tracks` column on every read from `editProjects`. Start throwing on malformed data in test/staging. This will reveal any existing corrupt data.

### Phase 5: Error Handling

14. **Convert services to throw `AppError`** instead of returning null/undefined for not-found cases.

15. **Remove try/catch from route handlers** one route at a time, relying on the global error handler. Verify behavior with integration tests at each step.

### Phase 6: Infrastructure Cleanup

16. **Relocate video generation providers** to `services/video-generation/providers/`.

17. **Move Firebase sync logic** from `services/firebase/sync.ts` to `domain/auth/auth.service.ts`.

18. **Audit and delete dead code** identified in section 10.

---

## Summary: What This Changes

After this reorganization:

- **Routes are < 200 lines** each — they validate, delegate, respond
- **All Drizzle queries live in repositories** — changing a column touches one file
- **Business logic is in `domain/` services** — testable without HTTP or database
- **One error shape** across the entire API — `{ error, code, details? }`
- **All routes use `zValidator`** — no untyped request bodies
- **JSONB timeline state is strictly typed and validated at runtime** — no more silent timeline corruption
- **Video provider selection is explicit** — not scattered across route handlers
- **Feature types are co-located with domain logic** — `domain/editor/editor.types.ts` not `features/editor/types/`
- **Tests can mock repositories** — unit tests for service logic don't need a real database

The codebase goes from 32,000 lines where the largest single file is 2,362 lines and contains FFmpeg filter generation next to HTTP response formatting, to a structure where every file has one clearly named job and the right size for that job.
