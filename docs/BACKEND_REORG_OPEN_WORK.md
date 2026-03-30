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

- [x] **Finish moving “fat route” logic into domain services** (incremental)  
  **Earlier:** `customer` (Stripe/profile/settings), **`domain/chat/chat-tools.ts`**, **`domain/video/video.service.ts`**.  
  **This batch:** **`users`** — Firebase admin orchestration → **`domain/users/users-admin-commands.ts`**; **`assets`** — upload parsing/limits/mime → **`domain/assets/user-upload.ts`**; **`subscriptions`** — Firestore + Stripe portal/checkout → **`domain/subscriptions/subscription-flows.ts`**; **`admin` config status** — AI/video/API-key dashboards → **`domain/admin/admin-config-status.ts`**.  
  **Still mixed:** optional further thinning elsewhere; **`domain/chat/chat-tools.ts`** remains the main bulk.

- [x] **Route file size ~≤200 lines** (partial)  
  **`users`**, **`assets`**, **`subscriptions`**, and **`admin/config/`** are split into sub-routers (each file typically well under 200 lines; mount-only `index.ts` files are tiny). **`customer`** and **`chat`** as before. **`chat/send-message.router.ts`** is thin (middleware + `createChatSendMessageStreamResponse`). **`admin/subscriptions/`** — list + analytics sub-routers; Firestore fetch/analytics in **`domain/admin/admin-subscriptions-firestore.ts`**. Remaining large: **`domain/chat/chat-tools.ts`** (~1.5k).

- [x] **Optional: `domain/video/video.service.ts` (§3.3, §9.3)**  
  Façade re-exporting `generateVideoClip`, `getVideoGenerationProvider`, and clip/provider types from `services/video-generation`. **`reel-job-runner`** and **`domain/chat/chat-tools`** import from it.

- [x] **Optional: wire `validateTimeline` into the video HTTP API**  
  **`POST /api/video/timeline/validate`** — `routes/video/timeline-validate.router.ts` (auth + CSRF + JSON body `generatedContentId` + `timeline`). Removed unused re-export stub `routes/video/timeline-validation.ts`.

---

## Priority 3 — Wiring and types (architecture hygiene)

- [ ] **Constructor injection / explicit factories (§4 Rule 2)** (partial)  
  Domain services should receive repositories (and infra ports) via constructors or factories; **`domain/singletons.ts`** remains the single composition root. **`db` is only wired in `singletons.ts`** (no stray `services/db/db` imports under `domain/`). **Done:** source-reel generation (**`domain/content/source-reel-generation.ts`** + **`IContentRepository`**); **reel AI analysis** (**`domain/reels/reel-analysis-run.ts`** + **`IReelsRepository.upsertReelAnalysis`**); scrape post-save analysis calls **`reelsService.runBackgroundReelAnalysis`** (composition root) instead of importing a service-layer **`db`** module for analysis. **Remaining:** **`services/scraping/scraping.service.ts`** still owns niche ingest + **`db`** (large adapter); optional thin **`ScrapingRepository`** later.

- [ ] **Repository interfaces** (partial)  
  Where missing, add `I*Repository`-style contracts so services depend on interfaces, not concrete Drizzle classes (architectural goal; not test-gated). **Drift fixes:** `IContentRepository` (source-reel + chain helpers); **`IReelsRepository.upsertReelAnalysis`** (reel analysis AI persistence); `IAssetsRepository.findR2KeyByIdAndUserId`; `IUsersRepository.updateUser` includes `hasUsedFreeTrial`; chat/admin/projects fixes as before. **`bun x tsc --noEmit`** passes.

- [x] **Types co-located in `domain/<feature>/*.types.ts` (§6.3, target summary)** (incremental)  
  Customer, subscription, order, and payment API types live under **`domain/customer/customer.types.ts`**, **`domain/subscriptions/subscriptions.types.ts`**, **`domain/orders/order.types.ts`**, **`domain/payments/payment.types.ts`**; **`types/index.ts`** re-exports from domain. **Script shot bounds, `parseScriptShots`, caption source text, and TTS helpers** now live under **`domain/video/`** and **`domain/audio/`** (backend **`src/shared/`** removed). Remaining: tighten JSONB domain types where the editor timeline types do not yet cover a surface.

---

## Priority 4 — Validation and JSONB policy

- [x] **Queue list / `editProjectTracks` policy (§11 Phase 4)**  
  Queue list items do not return `tracks` to the client; `editProjectTracks` from the join is used only inside `deriveStages` for placeholder heuristics. Documented in `queue.service.ts`.

- [x] **Audit all `editProjects` / `.tracks` readers**  
  `rg` review: editor GET/save paths use `parseStoredEditorTracks` where the client receives or persists timeline JSON; queue path is non-exposing (see above).

- [x] **Form-data / multipart** (incremental)  
  **`domain/assets/media-library-upload.ts`** — **`parseMediaLibraryUploadForm`** for **`POST /api/media/upload`** (file, name, mime, size limits). Further Zod/`zValidator` on multipart can wait until another upload surface is added.

- [x] **Schema file naming (§7)** (partial — good enough for listed surfaces)  
  **`domain/video/video.schemas.ts`** … **`routes/video/schemas.ts`**. **`domain/chat/chat.schemas.ts`** … **`domain/projects/projects.schemas.ts`**, **`domain/admin/admin.schemas.ts`**, **`domain/editor/editor.schemas.ts`**, **`domain/queue/queue.schemas.ts`**, **`domain/content/content.schemas.ts`**. **`domain/reels/reels.schemas.ts`** — list/export/bulk (`routes/reels/index.ts`). **`domain/reels/reel-analysis.schemas.ts`** — AI tool shape (`reelAnalysisToolSchema`) for analysis persistence. **`domain/music/music.schemas.ts`**, **`domain/audio/audio.schemas.ts`** — **`routes/music`**, **`routes/audio`**. Further optional: extract shared **`validationErrorHook`** factory to reduce duplication across routers.

---

## Priority 5 — Infrastructure and `services/` cleanup (§6, §9)

- [ ] **`services/` = adapters only (§9.1)** (partial)  
  Target layout: config, csrf, db, email, firebase, **http**, observability, rate-limit, **scraping**, storage, timezone, tts, **`video-generation`**. **Done:** **`services/http/`**; **`services/video-generation/`**; **`services/scraping/`** (niche scrape; async analysis delegated to **`reelsService`**); unit tests under **`__tests__/unit/services/http/`** and **`video-generation/`**. **Removed:** **`services/reels/`** (reel analysis → **`domain/reels/reel-analysis-run.ts`**); **`services/session/`** (unused Firebase-era stub). **Still separate:** **`request-identity/`** (IP + JWT peek for rate limiting); **`scraping.service.ts`** remains DB-heavy.

- [x] **Firebase split (§9.2)** (audited)  
  **`services/firebase/`** — Admin SDK (**`admin.ts`**), Firestore client (**`config.ts`**), Stripe-extension Firestore readers (**`stripe-payments.ts`**, **`subscription-helpers.ts`**). No Postgres user upsert here. **User sync / JWT path** remains **`domain/auth/`** (`auth.service`, `auth.repository`, `firebase-user-sync` pattern per existing code).

- [x] **Video provider registry**  
  **`services/video-generation/provider-registry.ts`** — `videoGenerationProvidersById`, **`getAdminVideoProviderRows`**, **`getCustomerVideoProviderRows`**; **`provider-selector.ts`** and **`domain/admin/admin-config-status`**, **`domain/customer/customer-settings-defaults`** use it (no duplicated provider `import()` lists). Re-exported from **`services/video-generation/index.ts`**.

- [x] **Health route symmetry**  
  **`GET /api/health`** no longer imports **`db`**. Database liveness uses **`authRepository.pingDatabaseForHealth()`** (`SELECT 1` + existing **`pingUsersTable()`**). Route still imports **`getQueryStats`** from **`services/db/db`** (in-process query metrics only).

---

## Priority 6 — Dead code and noise (§10)

Verify with grep before deleting.

- [x] **Backend `src/features/*/`**  
  Removed; API types live under `domain/**.types.ts` with `types/index.ts` re-exports.

- [x] **Inline helpers that belong in domain**  
  **`domain/assets/media-library-upload.ts`** — media upload parsing. **`buildFfmpegAtempoChain`** in **`domain/editor/timeline/composition.ts`**; **`deriveStages`** in **`domain/queue/pipeline/stage-derivation.ts`**.

- [x] **Manual `c.req.json()` + field checks**  
  No raw `c.req.json()` under **`src/routes`**. **`POST /api/generation`** body destructuring aligned with **`generateContentSchema`** (`sourceReelId`, not legacy `reelId` / unused fields).

- [x] **Duplicate auth / env types** (route layer)  
  **`AuthResult` / `HonoEnv`** are defined in **`types/hono.types.ts`**; **`middleware/protection`** re-exports only. **`routes/csrf.ts`** now types the app with **`HonoEnv`** from **`types/hono.types.ts`** (not `middleware/protection`).

- [x] **`backend/src/shared/`**  
  Removed; former **`shared/services/*`** and **`shared/constants/video-shot-durations`** moved to **`domain/audio/`** and **`domain/video/`**.

- [x] **Low-value `debugLog.info` noise** (routes)  
  **`routes/analytics`** — removed earlier. **`routes/*`** now use **`debugLog`** mainly for **`warn`/`error`** (e.g. media R2 delete, editor export, timeline refresh). Removed unused **`debugLog`** import from **`routes/admin/system.router.ts`**.

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
