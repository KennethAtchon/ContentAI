# ContentAI Code Guidelines

The hard rulebrick. Every PR is reviewed against this. If a rule must be broken, the PR description must say why.

Rules ladder by severity:

- **MUST** — non-negotiable. Block the PR.
- **SHOULD** — strong default. Deviation needs justification in the PR.
- **PREFER** — taste / consistency. Reviewer's call.

This doc supersedes any contradicting habit in older code. When you touch old code that violates a rule, fix it in the same PR if it's a small lift; otherwise leave a `TODO(guidelines):` and link the rule.

---

## 1. Layering & file placement

**1.1 (MUST) Backend folders have one job.** Each file belongs to exactly one of:


| Folder             | Holds                                                                 | Rule of thumb                                                                             |
| ------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `routes/`          | Hono route definitions, request parsing, response shaping             | No business logic. No raw Drizzle.                                                        |
| `domain/<area>/`   | Business logic, repositories, schemas, types for one area             | All multi-step business operations live here.                                             |
| `services/<area>/` | Cross-cutting infrastructure (firebase, storage, redis, http, tts)    | No business rules. Reusable across domains.                                               |
| `lib/`             | Tiny pure helpers (`cost-tracker.ts`, `chat-tools.ts`)                | If it grows past ~150 lines or has stateful clients, promote to `services/` or `domain/`. |
| `middleware/`      | Hono middleware (auth, csrf, rate-limit, error handling)              | One concern per file.                                                                     |
| `utils/`           | Stateless, no-deps helpers (date, error class, validation primitives) | If it imports a service or repo, it's not a util.                                         |


**1.2 (MUST) Frontend dependency direction.** `shared/` MUST NOT import from `domains/` or `app/`. `domains/X/` MAY import from `shared/`. `domains/X/` SHOULD NOT import from `domains/Y/` — if you need composition, expose a slot prop and let the route compose.

**1.3 (MUST) Routes are thin.** A route file (`routes/...`) does composition + page-level data fetching only. UI logic lives in `domains/`. Keep route files under ~150 lines.

**1.4 (SHOULD) Component file size.** UI components SHOULD be under 300 lines. Hard limit 500. Over 300 is a smell, over 500 needs a split-or-justify in the PR. Reference: PR 4 split `SystemConfigView` 1866 → 105.

---

## 2. Errors & catches

**2.1 (MUST) Every `catch` block does exactly one of three things.**

```ts
// (a) Re-throw — optionally transform
} catch (err) {
  throw Errors.fromUnknown(err);
}

// (b) Log + documented fallback
} catch (err) {
  systemLogger.warn("DB read failed; using static default", {
    service: "subscription-constants",
    operation: "getTrialDays",
    error: err instanceof Error ? err.message : String(err),
  });
  return STATIC_DEFAULT;
}

// (c) Silent fallback IS the contract — must be commented
} catch {
  // expected: malformed JSON — caller treats null as "no cache"
  return null;
}
```

Empty `catch {}` with no comment, no log, no re-throw is a bug. Reference: B4.

**2.2 (MUST) `systemLogger` for production-visible events. `debugLog` for dev-only diagnostics.**

`debugLog` only fires when `NODE_ENV=development` (`backend/src/utils/debug/debug.ts`). If your log needs to be visible in production (errors, warnings, security events, degradation signals), use `systemLogger`. Reference: B10.


| Use                                                      | Logger                             | Example                                 |
| -------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Decryption failure, auth failure, security event         | `systemLogger.error` / `.security` | Encrypted config could not be decrypted |
| DB unavailable, cache miss for hot path, fallback to ENV | `systemLogger.warn`                | API key DB lookup fell back to env      |
| Per-request trace, parameter dump, hot-path verbose      | `debugLog.debug`                   | Logging the request shape               |


**2.3 (MUST) Throw `AppError`, not raw `Error`, in domain code.** Use `Errors.notFound("Reel")`, `Errors.unauthorized()`, etc. The error handler relies on `AppError`'s `code` and `statusCode` fields.

**2.4 (SHOULD) Don't swallow errors in UI components.** A failed mutation must show toast or update visible state. Background fetches that fail silently produce zombie UIs.

---

## 3. Validation & contracts

**3.1 (MUST) Zod schemas live in `backend/src/domain/<area>/<area>.schemas.ts`.** Routes import from there. No re-defining schemas in route files.

**3.2 (MUST) One Zod-error formatter.** Use the canonical hook in `backend/src/validation/zod-validation-hook.ts`. Don't make a per-domain copy. Reference: B5.

**3.3 (MUST) Validate at the system boundary.** Every POST/PATCH/DELETE route uses `zValidator()`. Every external response is parsed with Zod or trusted only via a typed client.

**3.4 (SHOULD) Schemas declared once, shared FE↔BE.** Target: `packages/contracts/` workspace package exporting Zod schemas + inferred types, consumed by both apps. Until that exists, keep frontend form schemas thin and treat the backend schema as the canonical contract — frontend may add UX-layer refinements but cannot relax backend constraints. Reference: X1.

**3.5 (SHOULD) Don't re-create Zod schemas inside React components.** Lift them to module scope, or `useMemo` if they depend on `t()`. Reference: F6.

---

## 4. Database & repositories

**4.1 (MUST) Drizzle is only used inside `domain/<area>/<area>.repository.ts`.** Routes, services, and other domains call repositories — never `db()` directly.

**4.2 (MUST) Repositories expose typed methods, not query builders.** A repo method has a single, named purpose: `findVideoR2UrlForReel(id)`, not `query(builder => ...)`.

**4.3 (SHOULD) Constructor-injection for testability.** Services receive their repo via constructor. The IoC container in `domain/singletons.ts` wires production instances. Test code constructs services with fakes/mocks directly.

---

## 5. State & data fetching (frontend)

**5.1 (MUST) TanStack Query owns server state.** Cache, invalidation, and refetching go through `useQuery` / `useMutation` and the query-keys registry in `app/query/`. No bespoke `useEffect(fetch)` for server data.

**5.2 (SHOULD) Zustand for cross-cutting client state, Context for set-once config, `useState` for local.**


| Use                                                                                                              | Tool                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| User auth/profile/locale (set once, rarely updates)                                                              | React Context (existing pattern)            |
| Editor selection/playhead/clip state, chat streaming buffer, audio playback (many subscribers, frequent updates) | Zustand store under `domains/<area>/state/` |
| Component-local form state, toggles, local UI flags                                                              | `useState`                                  |
| Cached server data                                                                                               | TanStack Query                              |


**5.3 (MUST) All authenticated requests go through `useAuthenticatedFetch()` or the `authenticated-fetch` module.** No bespoke `fetch()` calls in components.

---

## 6. Forms

**6.1 (MUST) `react-hook-form` + `zodResolver(schema)` for any form with more than one field.**

**6.2 (MUST) Use shadcn `<FormField>` primitives.** Don't hand-roll labels, errors, and aria wiring.

**6.3 (SHOULD) Schema declared at module scope** (or `useMemo`'d if it needs `t()`). Never declared inline in render.

---

## 7. TypeScript

**7.1 (MUST) Both `tsconfig.json` files have `strict: true`.** Plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Reference: F1.

**7.2 (MUST) No `as any`, `as unknown as`, or `@ts-ignore` without a one-line comment explaining why.** The comment names what the type system can't model. If three or more such casts cluster in one feature, the type model is wrong — refactor types instead of casting.

**7.3 (SHOULD) No defensive non-null assertions (`!.`).** If `metadata` could be undefined, narrow with `if (!metadata) return ...` or use optional chaining. Reserve `!` for cases where the value is provably defined (array index after length check, etc).

**7.4 (SHOULD) Prefer `unknown` over `any` for "we don't know yet".** Force narrowing at the use site.

---

## 8. Logging & observability

**8.1 (MUST) Every `systemLogger` call carries `{ service, operation }` context.**

```ts
systemLogger.warn("AI provider DB lookup failed; using default", {
  service: "ai-config",
  operation: "getProviderPriorityAsync",
  error: err instanceof Error ? err.message : String(err),
});
```

**8.2 (SHOULD) No `console.log` in `backend/src` or `frontend/src` outside `system-logger.ts` and `firebase-logging.ts`** (and Vite-time scripts). Use the loggers.

**8.3 (MUST) PII goes through the sanitizer.** Emails, phone numbers, names — sanitize before logging. Both apps have `pii-sanitization`.

---

## 9. Naming

**9.1 (SHOULD) Filenames: `kebab-case.ts` for everything except React component files, which are `PascalCase.tsx`.** Hooks files use `use-X.ts`. Pick one and stick with it within a folder.

**9.2 (SHOULD) Backend route files end in `.router.ts`.** Existing `*.ts` route files get renamed when touched.

**9.3 (MUST) Domain file naming follows the pattern:**

```
domain/<area>/
  <area>.service.ts
  <area>.repository.ts
  <area>.schemas.ts
  <area>.types.ts
```

---

## 10. Imports & module graph

**10.1 (MUST) Use path aliases (`@/...`), not relative imports across more than one level.** `./helpers` is fine. `../../../shared/foo` is not.

**10.2 (SHOULD) No barrel `index.ts` re-exports for internal modules.** Barrel files only at domain *public-API* boundaries (e.g. `domains/X/index.ts` exporting the public hooks/types). Internal sub-folders import directly. Reference: X2.

**10.3 (MUST) No deceptive re-export shims.** A 1-line file that re-exports from another module hides dependency direction. If you want to flatten an import path, export from the canonical location and update callers. Reference: PR 2.

---

## 11. Comments & docs

**11.1 (MUST) No comments that restate the code.** A comment must explain *why*, not *what*.

**11.2 (SHOULD) Hidden constraints, subtle invariants, workarounds, and surprising decisions get a one-line comment.** "Why is this here?" should be answerable from the comment alone.

**11.3 (MUST NOT) Reference current task/fix/PR in comments.** No `// added for the chat flow`, no `// see issue #123`. That info belongs in the commit message and PR description.

**11.4 (SHOULD) JSDoc only on public exports** (functions/types exported from a domain or shared module). Internal functions: no docstring unless behavior is non-obvious.

---

## 12. Tests

**12.1 (SHOULD) Backend integration tests in `backend/__tests__/integration/`. Unit tests in `backend/__tests__/unit/`.** Mirror the `src/` tree.

**12.2 (SHOULD) Frontend hook + utility tests live in `frontend/__tests__/`.** Component tests for non-trivial components (state machines, form flows). E2E for critical user paths in `e2e/__tests__/e2e/`.

**12.3 (MUST) Integration tests hit a real database** (containerized). No mocking the DB. If a test needs a fixture, put it in `backend/fixtures/`.

---

## 13. Security

**13.1 (MUST) CSRF middleware on every mutation route** (POST/PATCH/PUT/DELETE). GETs are exempt.

**13.2 (MUST) No raw HTML injection in JSX.** No escape hatches like the React prop named for that purpose.

**13.3 (MUST) Secrets never leave the backend.** Encrypted config has `isSecret: true` and is redacted in `getAll()` / `getCategoryPublic()`.

**13.4 (MUST) Authentication checks via `authMiddleware`, authorization via explicit role checks in the route or service.** No "trust the client to send the right user ID" — the user comes from the auth context.

---

## 14. Refactor discipline

**14.1 (MUST) One concern per PR.** PR 1 logs catches; PR 4 splits `SystemConfigView`. Mixing both is one un-reviewable diff.

**14.2 (SHOULD) Touch-and-fix.** When you edit a file that violates a rule (catch without log, `as any` without comment), fix the violation in the same PR if it's under ~10 lines of work. Otherwise file a follow-up.

**14.3 (MUST NOT) "Backwards compatibility" shims for unused code.** Delete it. No `// removed for X` markers, no renamed-to-`_var` corpses.

---

## Appendix: review references

The findings that motivated each rule live in `docs/code-review-2026-04-25.md`. When updating this doc, link the section that justified the rule.