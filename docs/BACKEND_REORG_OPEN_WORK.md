# Backend reorganization — open work (checklist)

**Purpose:** Single queue of **remaining** work for the backend reorg described in [`BACKEND_REORGANIZATION.md`](./BACKEND_REORGANIZATION.md).  
**Scope:** Same as that doc — layout, repositories, thin routes, validation, `AppError` coverage, `services/` cleanup, §10 dead-code passes.  
**Out of scope:** New automated unit/integration tests and mandatory repository mocks (track under your testing roadmap).

**How to use:** Work top to bottom within each priority band. Re-verify with `rg` before large deletes (see [Verification](#verification)).

---

## Priority 1 — API contract and domain behavior (highest)

These items most affect client expectations and correctness of business rules.

- [x] **Standardize errors on `{ error, code, details? }` (§8.1)**  
  Route handlers updated: `video` (reel/shot/jobs), `customer/settings`, `reels`, `audio`, `music`, admin sub-routers (`orders`, `costs`, `customers`, `feature-usages`, `analytics`, `verify`), `csrf`, `health` (error-monitoring throws), root `GET /api/metrics` (throws). `jsonError` / `jsonResponse` paths now default or set `code` (protection helpers, comprehensive rate limiter). Remaining manual shapes: validation hooks and middleware that already return `{ error, code, details? }`.

- [x] **Domain services: prefer throw over null + branch (§8)**  
  `AdminService` `updateOrder` / `deleteOrder` / `getOrderById` now throw `Errors.notFound` / `Errors.internal` instead of returning `null`; admin orders routes no longer branch on `null`.

- [x] **Client audit for legacy error shapes**  
  Frontend `authenticatedFetchJson` surfaces API `error` text via `formatApiErrorForThrow` and attaches parsed `body` on thrown `Error` for callers that need `code` / extra fields. Server: `PROJECT_EXISTS` still promotes `existingProjectId` to the top level; `VIDEO_JOB_IN_PROGRESS` promotes `jobId` and `kind` the same way for compatibility.

- [x] **Remove redundant `try/catch` in routes**  
  Removed log-and-500 catches from the routes above; `handleRouteError` logs unhandled non-`AppError` failures. **Kept:** `audio` `POST /tts` (maps provider errors to `AppError`), `health` `GET /` (structured unhealthy payload), `subscriptions` Firebase callable error parsing.

---

## Priority 2 — Business logic and route thinness

Goal: HTTP adapters only; orchestration and rules in `domain/*`.

- [ ] **Finish moving “fat route” logic into domain services**  
  **Called out as still mixed:** `customer`, `users`, `chat`, `generation`, `auth`, `assets`, `subscriptions`, and parts of **admin** / **video** (beyond what is already in `domain/admin` and `domain/video`).  
  Target: handler = validate → call one service method → return.

- [ ] **Route file size ~≤200 lines (§3, target summary)**  
  **Often still large per plan:** `customer`, `users`, `chat`, `generation`, `admin` (e.g. `niches`, `music`, `config`, `subscriptions.router`), `assets`, `subscriptions`, `lib/chat-tools.ts` (large; SQL already via `chatToolsRepository` — further split or domain wrappers as needed).  
  **Already in better shape:** editor mount + many sub-routers, queue routers, several admin sub-routers, thin music/audio/reels/public contact paths.

- [ ] **Optional: `domain/video/video.service.ts` (§3.3, §9.3)**  
  Thin façade over `getVideoGenerationProvider` + `generateVideoClip` (and related job updates) so routes and chat-tools depend on one domain entry point.  
  **Note:** Reel/shot job orchestration already lives in `domain/video/reel-job-runner.ts`; timeline validation in `domain/video/timeline-validation.ts` — this item is an extra consolidation layer, not a duplicate move.

- [ ] **Optional: wire `validateTimeline` into the video HTTP API**  
  Domain + tests exist; product may still need an explicit route or pipeline step that calls `validateTimeline` / `normalizeTimelineForPersistence` before persisting or enqueueing work.

---

## Priority 3 — Wiring and types (architecture hygiene)

- [ ] **Constructor injection / explicit factories (§4 Rule 2)**  
  Domain services should receive repositories (and infra ports) via constructors or factories; **`domain/singletons.ts`** remains the single composition root. Eliminate ad hoc globals inside domain where they remain.

- [ ] **Repository interfaces**  
  Where missing, add `I*Repository`-style contracts so services depend on interfaces, not concrete Drizzle classes (architectural goal; not test-gated).

- [ ] **Types co-located in `domain/<feature>/*.types.ts` (§6.3, target summary)**  
  Reduce scattered feature types and tighten JSONB domain types where the editor timeline types do not yet cover a surface.

---

## Priority 4 — Validation and JSONB policy

- [x] **Queue list / `editProjectTracks` policy (§11 Phase 4)**  
  Queue list items do not return `tracks` to the client; `editProjectTracks` from the join is used only inside `deriveStages` for placeholder heuristics. Documented in `queue.service.ts`.

- [x] **Audit all `editProjects` / `.tracks` readers**  
  `rg` review: editor GET/save paths use `parseStoredEditorTracks` where the client receives or persists timeline JSON; queue path is non-exposing (see above).

- [ ] **Form-data / multipart (optional)**  
  Shared helpers or Zod preprocess for file upload fields where it improves consistency (thumbnails, etc.); keep intentional manual parsing where appropriate.

- [ ] **Schema file naming (§7)**  
  Align remaining route-only schemas with `domain/<feature>/<feature>.schemas.ts` as the canonical home; routes re-export or import from domain.

---

## Priority 5 — Infrastructure and `services/` cleanup (§6, §9)

- [ ] **`services/` = adapters only (§9.1)**  
  Flatten layout to: config, csrf, db, email, firebase, observability, rate-limit, scraping, storage, timezone, tts, **video-generation**. Move any embedded business rules into `domain/`.

- [ ] **Firebase split (§9.2)**  
  Keep **`services/firebase`** to Admin SDK init + token verify; ensure no duplicate user-sync paths — business sync stays in **`domain/auth/`** (`auth.service`, `firebase-user-sync`, etc.).

- [ ] **Video provider registry (optional)**  
  Single **`services/video-generation/provider-registry.ts`** (or similar) so admin UI / customer flows do not duplicate dynamic `import()` maps.

- [ ] **Health route symmetry (optional)**  
  `routes/health/index.ts` is the only route that intentionally imports `db`; optional tiny repository “ping” helper for consistency with the rest of the stack.

---

## Priority 6 — Dead code and noise (§10)

Verify with grep before deleting.

- [ ] **Backend `src/features/*/`**  
  If any remain under `backend/src`, remove after types absorbed into `domain/`.

- [ ] **Inline helpers that belong in domain**  
  Any remaining inline `buildFfmpegAtempoChain`, `deriveStages`, or similar in route files — should live under `domain/editor/timeline/` or `domain/queue/pipeline/` only.

- [ ] **Manual `c.req.json()` + field checks**  
  Replace with `zValidator` / shared schemas; delete duplicate validation blocks.

- [ ] **Duplicate auth / env types**  
  Ensure `AuthResult` / `HonoEnv` live only in `types/hono.types.ts`; remove duplicates from `middleware/protection` or old feature type files.

- [ ] **`src/shared/` audit**  
  Move or delete utilities that now belong under `domain/` or `services/` after reorg.

- [ ] **Low-value `debugLog.info` noise**  
  Remove “request received” / “starting operation” style logs with no diagnostic value.

- [x] **Backup / stray files**  
  Removed `backend/src/routes/customer/index.ts.bak`.

---

## Verification

From `backend/`:

```bash
# Route-layer Drizzle (expect only health + intentional cases)
rg 'services/db/db' src/routes

# All db imports (singletons, jobs, config remain valid)
rg 'services/db/db' src

# Timeline / JSONB read audit
rg 'editProjects|\.tracks' src/routes src/domain

# Manual error responses still to convert
rg 'c\.json\(\s*\{\s*error:' src/routes
```

---

## Reference

- **North star:** [`BACKEND_REORGANIZATION.md`](./BACKEND_REORGANIZATION.md) §1–§10.  
- **Living status snapshot:** same file §11 (implementation status + phase checklists).  
- **When this list drifts:** After a batch of work, reconcile checked items here with §11 or replace §11’s “remaining work” with a pointer to this file.
