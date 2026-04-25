# ContentAI Code Review — 2026-04-25

Audit of `frontend/` and `backend/` for anti-patterns, organizational drift, and inconsistencies. Findings include `file:line` citations. Severity is P1 (must-fix) / P2 (should-fix) / P3 (cleanup).

This document is **observational**. Once we agree on findings, we'll distill the rules into a separate `code-guidelines.md`.

---

## TL;DR — Remaining priorities

1. **Schemas/contracts still live in multiple places.** The worst constant drift is fixed, but there is still no shared contract source of truth. → see X1
2. **Empty `catch {}` blocks remain.** Critical cases were patched, but many silent fallbacks still need an audit. → see B4
3. **Cross-domain UI imports** (chat → video, video → reels/generation) still lack a clear composition boundary. → see F4
4. **452 `index.ts` barrel files.** Indirection cost > benefit for internal modules. → see X2
5. **`domain/` vs `services/` vs `lib/` is still muddy.** New files still force a placement decision every time. → see B1
6. **`any` casts and defensive assertions remain.** Some were cleaned up, but the broader audit is still open. → see X3
7. **Frontend tests are still thin.** E2E coverage exists, but hooks/utilities and critical paths need real unit coverage. → see F10
8. **Several large admin/debug components still need decomposition.** `SystemConfigView` is fixed; the others remain. → see F2
9. **Route/file naming conventions are still mixed.** Some cleanup landed, but the repo is not consistent yet. → see B2, F8
10. **Folder depth and internal indirection still trend high.** Payments and barrel-heavy areas are still harder to navigate than they need to be. → see X2, X4

---

## Backend

### B1. Layering — `routes/` is clean, but `domain/` vs `services/` vs `lib/` is muddy

Routes correctly delegate to services. No raw Drizzle in routes. ✅

But there are **three buckets for "code that does work"**:


| Folder             | Holds                                 | Example                                                                  |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| `domain/<area>/`   | Business logic, repositories, schemas | `domain/editor/editor.service.ts`                                        |
| `services/<area>/` | Cross-cutting / infra                 | `services/firebase/`, `services/storage/`                                |
| `lib/`             | Residual helpers / unclear placement  | `lib/queue-chain-guard.ts`                                                |


**Problems:**

- Video logic still lives in both `domain/video/` and `services/video-generation/`, and the boundary between domain orchestration and provider infrastructure is still implicit rather than obvious.
- Cross-cutting service code has improved (`services/ai/`, `services/observability/ai-cost-recorder.ts` now exist), but the repo still lacks a simple placement rule people can apply without judgment calls.
- `lib/` is much smaller now, which is progress, but the broader taxonomy question is still open.

**Severity: P2.** Not broken, but every new file forces a "where does this go?" decision.

### B2. Routes — naming inconsistent

- Some files: `*.router.ts` (`orders.router.ts`, `editor-projects.router.ts`)
- Some files: `*.ts` (`niches.ts`, `music.ts`, `csrf.ts`)
- Some folders: `index.ts` only (`health/index.ts`)

**Severity: P3.** Pick one (`*.router.ts` reads best).

### B4. Empty catches — silent fallbacks

55 empty catches across 32 files. Most are defensible (best-effort cleanup, `safe`* parser contracts, stream-already-closed). The genuinely silent failures hide DB/infra degradation:

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
3. Bear a `// expected: <reason>` comment if silent fallback is the contract (e.g. `safe`* parsers, best-effort cache writes)

**Status:** PR 1 patches the 6 critical ones above. Rest get audited as PRs touch them.

**Severity: P1.** Production debugging killer.

### B5. Validation — Zod schemas re-exported through too many paths

Source-of-truth: `domain/<area>/<area>.schemas.ts`. ✅

The canonical hook now lives in `validation/zod-validation-hook.ts`, and the route-local wrapper files were removed. The remaining problem is consistency: route modules still mix direct domain-schema imports and route-local validation wiring patterns instead of following one obvious convention everywhere.

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

### F2. Mega-components


| File                                                      | Lines               | Status |
| --------------------------------------------------------- | ------------------- | ------ |
| `routes/admin/_layout/developer.tsx`                      | 594                 | P2     |
| `domains/admin/ui/developer/DeveloperView.tsx`            | 589                 | P2     |
| `domains/admin/ui/niches/NicheDetailView.tsx`             | 584                 | P2     |
| `shared/debug/debug.ts`                                   | 554                 | P2     |


Remaining large admin/debug components still need the same split/decomposition treatment.

### F4. Cross-domain coupling

- `domains/chat/ui/`* imports from `domains/video/`, `domains/reels/`, `domains/generation/`
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

### F7. State management — mixed

- TanStack Query for server state ✅
- React Context for client state (auth, profile, app, audio) ✅
- Chat domain mixes Query + per-component `useState` for SSE streaming. No central streaming store.

**Severity: P2.** As chat features grow, this will need a real store (Zustand or context-with-reducer).

### F8. File naming inconsistent

- Hook naming is cleaner after the chat hook rename, but the repo still mixes conventions by kind.
- Components mix `SystemConfigView.tsx` (PascalCase) with `order-form.tsx`, `user-button.tsx`, `auth-guard.tsx` (kebab-case)

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

The immediate subscription-limit drift was fixed, and the dead frontend legacy validation file is gone. The underlying architectural issue still remains: backend and frontend continue to define API-facing contracts separately, and backend still carries older validation surface area in `backend/src/utils/validation/api-validation.ts`.

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


| P1 (must-fix)                                     | P2 (should-fix)                      | P3 (cleanup)                   |
| ------------------------------------------------- | ------------------------------------ | ------------------------------ |
| Empty catches (B4)                                | `domain`/`services`/`lib` split (B1) | Route file naming (B2)         |
| Schema duplication FE↔BE (X1)                     | Validation hook consistency (B5)     | Param validation dup (B6)      |
|                                                   | Cross-domain coupling (F4)           | Singletons / global state (B7) |
|                                                   | State mgmt — chat streaming (F7)     | Filename casing (F8)           |
|                                                   | Mega-components (F2 cont.)           | Barrel files (X2)              |
|                                                   | Frontend test coverage (F10)         | Folder depth (X4)              |
|                                                   | `any` / cast audit (X3)              |                                |


---

## Next step

Walk through findings together. Decide which we accept, push back on, or downgrade. Then I'll distill the agreed-on rules into `docs/code-guidelines.md` — short, prescriptive, the rulebrick you wanted.
