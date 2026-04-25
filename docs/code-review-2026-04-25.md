# ContentAI Code Review — 2026-04-25

Audit of `frontend/` and `backend/` for anti-patterns, organizational drift, and inconsistencies. Findings include `file:line` citations. Severity is P1 (must-fix) / P2 (should-fix) / P3 (cleanup).

This document is **observational**. Once we agree on findings, we'll distill the rules into a separate `code-guidelines.md`.

---

## TL;DR — Top 10 priorities

1. ~~`SystemConfigView.tsx` is 1,866 lines~~ ✅ Fixed in PR 4 — split into shell + 8 shared components + 7 per-tab files; tsc clean.
2. ~~Frontend `tsconfig` has `strict: false`~~ ✅ Fixed in PR 3 — strict + unused-locals/params + noImplicitReturns now on; 10 trivial errors fixed.
3. **Zod schemas duplicated across backend/frontend.** Same shape declared twice → drift risk. → `backend/src/domain/customer/customer.schemas.ts` vs `frontend/src/shared/validation/api.schema.ts`
4. **Shared layer leaks into domain.** `shared/ui/navigation/StudioTopBar.tsx` imports from `@/domains/auth/...` — breaks the dependency direction.
5. **Empty `catch {}` blocks + dev-only logger.** 55 empty catches; many that *do* log use `debugLog.error` which only fires in dev (`utils/debug/debug.ts:5`). Production goes silent. → see B4, B10
6. **Cross-domain UI imports** (chat → video, video → reels/generation). No clear composition layer. Coupling will compound.
7. **452 `index.ts` barrel files.** Indirection cost > benefit for internal modules.
8. **Two services folders.** `domain/*` vs `services/*` split unclear; `lib/` adds a third bucket. Pick a rule.
9. **20+ non-null assertions (`!.`)** mix of justified and defensive across both sides. Defensive ones hide nullability bugs.
10. **Frontend tests are stubs.** ~20 real test files; most empty. Hook + critical-path coverage is missing.

---

## Backend

### B1. Layering — `routes/` is clean, but `domain/` vs `services/` vs `lib/` is muddy

Routes correctly delegate to services. No raw Drizzle in routes. ✅

But there are **three buckets for "code that does work"**:

| Folder | Holds | Example |
|---|---|---|
| `domain/<area>/` | Business logic, repositories, schemas | `domain/editor/editor.service.ts` |
| `services/<area>/` | Cross-cutting / infra | `services/firebase/`, `services/storage/` |
| `lib/` | Mixed bag | `lib/cost-tracker.ts`, `lib/chat-tools.ts`, `lib/aiClient.ts`, `lib/ai/` |

**Problems:**
- Video logic lives in **all three**: `domain/video/`, `services/video-generation/`, `lib/cost-tracker.ts`.
- Chat tools split: `domain/chat/chat-tools.repository.ts` + `lib/chat-tools.ts`.
- `lib/aiClient.ts` is infra (should be `services/ai/`); `lib/ai/` already exists as a folder.

**Severity: P2.** Not broken, but every new file forces a "where does this go?" decision.

### B2. Routes — naming inconsistent

- Some files: `*.router.ts` (`orders.router.ts`, `editor-projects.router.ts`)
- Some files: `*.ts` (`niches.ts`, `music.ts`, `csrf.ts`)
- Some folders: `index.ts` only (`health/index.ts`)

**Severity: P3.** Pick one (`*.router.ts` reads best).

### B3. Error handling — `AppError` works, handler is brittle

`utils/errors/app-error.ts` defines a clean error type. Services throw it correctly.

But `middleware/error-handler.ts:18-36` hard-codes specific error codes (`PROJECT_EXISTS`, `VIDEO_JOB_IN_PROGRESS`) and reaches into `error.details` to pull domain-specific fields. Each new domain error needs a handler edit.

**Fix idea:** put response-shape logic on `AppError` itself (`error.toResponse()`), so the handler is dumb.

**Severity: P2.**

### B4. Empty catches — silent fallbacks

55 empty catches across 32 files. Most are defensible (best-effort cleanup, `safe*` parser contracts, stream-already-closed). The genuinely silent failures hide DB/infra degradation:

```ts
// backend/src/constants/subscription.constants.ts:24-34
catch {
  return SUBSCRIPTION_TRIAL_DAYS;  // DB down? trial logic now silently uses constant
}
```

Worst offenders:
- `constants/subscription.constants.ts:31, 221` — DB read for trial days / feature limits
- `lib/ai/config.ts:33, 70` — DB read for AI provider config
- `services/config/system-config.service.ts:95, 216` — decrypt fail / API key DB lookup

**Rule (to enforce in `code-guidelines.md`):** every `catch` block must do exactly one of:
1. Re-throw (with optional transform)
2. Log via `systemLogger.error|warn` with `{service, operation}` context, then return a documented fallback
3. Bear a `// expected: <reason>` comment if silent fallback is the contract (e.g. `safe*` parsers, best-effort cache writes)

**Status:** PR 1 patches the 6 critical ones above. Rest get audited as PRs touch them.

**Severity: P1.** Production debugging killer.

### B10. Two loggers — one is dev-only, devs use the wrong one

Two loggers exist:
- `utils/debug/debug.ts` — `debugLog.error/warn/info` only fires when `NODE_ENV === "development"`. **Invisible in production.**
- `utils/system/system-logger.ts` — `systemLogger.error/warn` always fires.

Many catch blocks that *do* log use `debugLog.error(...)` — e.g. `middleware/protection.ts:103, 164, 232`. In production, those errors disappear.

The naming makes the wrong choice the easy choice (`debugLog.error` reads as "the error logger").

**Rule:** structured production events → `systemLogger`. Development-only diagnostics → `debugLog`. Better fix: rename `debugLog` to `devLog` (or remove its `.error`/`.warn` methods — debug-level only).

**Severity: P1.** Auditing existing `debugLog.error|warn` callsites is a follow-up sweep.

### B5. Validation — Zod schemas re-exported through too many paths

Source-of-truth: `domain/<area>/<area>.schemas.ts`. ✅

But routes also have:
- `routes/customer/shared-validation.ts`
- `routes/editor/schemas.ts` (says "canonical definitions in domain/" — so why does this file exist?)
- `routes/editor/zod-validation-hook.ts`
- `validation/zod-validation-hook.ts`

There are **three separate Zod-error-formatter wrappers** (`zodValidationErrorHook`, `customerValidationErrorHook`, `editorZodValidationHook`). They do the same thing.

**Severity: P2.** Consolidate to one hook in `validation/`.

### B6. Param validation duplication

Routes declare param schemas twice — once in route definition, once in `zValidator(...)`:

```
routes/editor/editor-projects.router.ts:66
routes/customer/orders.router.ts:33
```

**Severity: P3.**

### B7. Singletons / IoC

`domain/singletons.ts` is a service-locator. Acceptable, but it makes unit testing painful — you can't inject a fake repo without module mocking. As tests grow, this will hurt.

`utils/system/app-initialization.ts:23-56` uses `(global as any).__lastMemoryAlert` etc. for rate-limiting. Process-scoped state is fine here, but the `any` cast is ugly — make a typed `globalState` module.

**Severity: P3.**

### B8. Logging

`debugLog` is used consistently. ✅ No `console.log` pollution outside intentional sites (`utils/system/system-logger.ts`, `services/observability/firebase-logging.ts`).

### B9. TODOs

12 `TODO` markers reference "Phase 2 — AI direct-edit", concentrated in `domain/editor/`. Tracked work, not rot. ✅

---

## Frontend

### F1. `tsconfig` is too loose ~~P1~~ ✅ FIXED in PR 3

Frontend was `strict: false`, backend `strict: true`. Asymmetric.

**Resolution:** Enabled `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Surfaced 10 unused-import/var errors (mostly stale `import React` from pre-JSX-transform code) — all fixed. Type check now clean. The codebase was already type-safe in practice; the flags were just off.

### F2. Mega-components

| File | Lines | Status |
|---|---|---|
| ~~`domains/admin/ui/system-config/SystemConfigView.tsx`~~ | ~~**1,866**~~ → 105 | ✅ PR 4 |
| `routes/admin/_layout/developer.tsx` | 594 | P2 |
| `domains/admin/ui/developer/DeveloperView.tsx` | 589 | P2 |
| `domains/admin/ui/niches/NicheDetailView.tsx` | 584 | P2 |
| `shared/debug/debug.ts` | 554 | P2 |

**PR 4 split `SystemConfigView`:** 1,866 lines → 105-line shell + 8 shared components (`components/`) + 7 tab files (`tabs/`) + `types.ts`. Each tab is now self-contained, individually readable, and tests/refactors can target a single concern. Type check clean.

Remaining 4 mega-components (all admin domain) downgraded to **P2** — same playbook applies.

### F3. Shared → domain leak

`shared/` should depend on **nothing** in `domains/`. Violations:

- `frontend/src/shared/ui/navigation/StudioTopBar.tsx` was a 1-line re-export of `@/domains/studio/ui/StudioTopBar` — deceptive shim that hid the leak. **Deleted in PR 2.**
- `frontend/src/shared/ui/layout/studio-shell.tsx` still imports `StudioTopBar` from `@/domains/studio/...` (after PR 2, directly instead of via shim). **Leak still present.**
- `domains/studio/ui/StudioTopBar.tsx` itself imports `UserButton` from `@/domains/auth/...` (cross-domain, separate concern — see F4).

**The real fix (deferred to PR 2b):** `studio-shell.tsx` is composition, not pure shared — it combines navigation + footer + auth-aware UI for 19 route consumers. Two options:

(a) Move `studio-shell.tsx` + `studio-footer.tsx` to `frontend/src/app/layout/` (app-level composition, mirrors `app/providers/`, `app/state/`).
(b) Convert `StudioShell` to take a `topBar` slot prop. Each route caller passes `<StudioTopBar variant="..." />`. Keeps `shared/` truly leaf-only.

Option (b) is more architecturally pure but requires updating all 19 callers.

**Severity: P1.** Architectural rule violation. PR 2 removed the misleading shim; PR 2b picks (a) or (b).

### F4. Cross-domain coupling

- `domains/chat/ui/*` imports from `domains/video/`, `domains/reels/`, `domains/generation/`
- `domains/studio/ui/StudioTopBar.tsx` imports `domains/auth/ui/user-button`
- `domains/video/ui/VideoWorkspacePanel.tsx` imports video/reels/generation

No composition layer. Either:
- (a) Define a `domains/_composition/` (or move composite UI to `routes/`), or
- (b) Be explicit that some domains are leaves and others compose.

**Severity: P2.** This is what kills monorepos when they grow.

### F5. Three fetch abstractions

- `shared/api/authenticated-fetch.ts` — 465 lines
- `shared/api/safe-fetch.ts` — 468 lines
- `domains/auth/hooks/use-authenticated-fetch.ts` — 52 lines (initial audit reported 1,331; that count was wrong)

Hook is a thin wrapper, fine. Real question is whether the two `shared/api/*-fetch.ts` files (~933 lines combined) need consolidation — different responsibilities (auth+toast vs retry+timeout) but possibly merge-able.

**Severity: P3** (downgraded from P1). Audit when next touched.

### F6. Form schemas re-created on every render

```tsx
// frontend/src/domains/admin/ui/orders/order-form.tsx:66-75
const schema = z.object({ ... t('field.label') ... })  // recreated each render
```

Either lift schema out (if i18n isn't needed inside) or `useMemo`.

**Severity: P3.** Perf is fine, hygiene is not.

### F7. State management — mixed

- TanStack Query for server state ✅
- React Context for client state (auth, profile, app, audio) ✅
- Chat domain mixes Query + per-component `useState` for SSE streaming. No central streaming store.

**Severity: P2.** As chat features grow, this will need a real store (Zustand or context-with-reducer).

### F8. File naming inconsistent

- Hooks: `use-portal-link.ts` and `usePortalLink.ts` both exist
- Components: `SystemConfigView.tsx` (PascalCase) vs `order-form.tsx` (kebab-case)

**Severity: P3.** Pick one per kind.

### F9. CSS — well-organized ✅

Tailwind only. Token hierarchy in `styles/globals.css` (primitives → studio aliases → semantic). No CSS modules, no inline styles. No raw-HTML-injection escape hatches. Keep it.

### F10. Test coverage

`frontend/__tests__/` exists but is mostly stubs. E2E tests (`e2e/`) cover sign-in/sign-up/admin flows ✅. Unit tests for hooks and utilities are missing.

**Severity: P2.**

---

## Cross-cutting

### X1. Schema duplication frontend ↔ backend

Same data shapes declared on both sides:
- Customer order schema: `backend/src/domain/customer/customer.schemas.ts` vs `frontend/src/domains/admin/ui/orders/order-form.tsx`
- Subscription tiers constant: defined in `backend/src/constants/subscription.constants.ts` AND `frontend/src/shared/constants/subscription.constants.ts`

**Fix idea:** shared package (`packages/contracts/`) with Zod schemas + types. Both sides import. Single source of truth.

**Severity: P1.** API contract drift = production bugs.

### X2. Barrel files

452 `index.ts` re-export files. Many domains have `model/index.ts`, `hooks/index.ts`, `ui/index.ts`. For internal use, this is indirection without payoff (and hurts tree-shaking).

**Rule of thumb:** barrel only at domain public-API boundary; not for internal sub-folders.

**Severity: P3.**

### X3. `any` and casts

- Backend: ~14 `as any` / `as unknown as`
- Frontend: ~13 `as any` / `as unknown as`
- ~20 non-null assertions on each side; many defensive (`metadata!.hashtags!`)

Each one is a "I know better than the type system" claim. Audit them; most are type-modeling gaps.

**Severity: P2.**

### X4. Folder depth

Worst offenders:
- `frontend/src/domains/payments/ui/checkout/subscription/` (12 deep)
- `frontend/src/packages/editor-core/src/wasm/fft/assembly/` (12 deep — WASM, acceptable)

**Severity: P3.** Flatten payments.

### X5. Security baseline ✅

CSRF middleware on all mutations. PII sanitizer mirrored on both sides. No raw HTML injection. Security baseline is solid.

---

## Severity rollup

| P1 (must-fix) | P2 (should-fix) | P3 (cleanup) |
|---|---|---|
| Empty catches (B4) | `domain`/`services`/`lib` split (B1) | Route file naming (B2) |
| Dev-only logger misuse (B10) | | |
| Frontend strict mode (F1) | Error-handler brittleness (B3) | Param validation dup (B6) |
| `SystemConfigView` size (F2) | Validation hook dup (B5) | Singletons / global state (B7) |
| Shared → domain leak (F3) | Cross-domain coupling (F4) | Form schema memo (F6) |
| ~~`use-authenticated-fetch.ts`~~ wrong count (F5) | State mgmt — chat streaming (F7) | Filename casing (F8) |
| Schema duplication FE↔BE (X1) | Mega-components (F2 cont.) | Barrel files (X2) |
| | Frontend test coverage (F10) | Folder depth (X4) |
| | `any` / cast audit (X3) | |

---

## Next step

Walk through findings together. Decide which we accept, push back on, or downgrade. Then I'll distill the agreed-on rules into `docs/code-guidelines.md` — short, prescriptive, the rulebrick you wanted.
