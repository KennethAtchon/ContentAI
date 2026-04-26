# Frontend Zustand Migration — Plan

> **Date:** 2026-04-25
> **Status:** Draft
> **Deciders:** Frontend maintainers, editor/frontend architecture owner

## 1. Problem Statement

The frontend still uses app-owned React context as the primary distribution mechanism for shared client state, even though the app has already grown into a multi-domain SPA with 49 `useApp()` call sites and multiple nested providers in the root tree. Today, auth state lives in [frontend/src/app/state/auth-context.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/auth-context.tsx), profile state lives in [frontend/src/app/state/profile-context.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/profile-context.tsx), theme state lives in [frontend/src/app/providers/theme-provider.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/providers/theme-provider.tsx), and audio playback coordination lives in [frontend/src/domains/media-suite/audio/state/AudioPlaybackContext.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/domains/media-suite/audio/state/AudioPlaybackContext.tsx). `useApp()` in [frontend/src/app/state/app-context.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/app-context.tsx) exists as a compatibility layer over those contexts, which means most consumers are still coupled to a cross-cutting context surface rather than narrow state selectors.

This is becoming a forcing function now for three reasons. First, React context causes all consumers of a changed value to re-render from that provider boundary, which makes shared-object context surfaces progressively harder to scale as the app grows. Second, the current state model mixes different classes of state together: Firebase session state, derived profile state, local persisted UI preferences, and feature-local coordination are all exposed through provider trees rather than domain stores. Third, the planned frontend/editor rebuild work will add more long-lived client state, and continuing to add new context providers would deepen the current coupling instead of simplifying it. If nothing changes, the frontend will keep accruing broad subscriptions, provider nesting, and migration drag every time we need to add a new shared state surface.

## 2. Goals & Non-Goals

**Goals**

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Remove app-owned React context as the default mechanism for shared frontend state | Auth, theme, profile facade, and audio playback no longer depend on app-specific `createContext` state containers |
| 2 | Standardize shared client state on Zustand | New shared client state is created as typed Zustand stores with selector-based consumption |
| 3 | Keep server state in TanStack Query | Profile and other API-backed resources remain query-driven instead of being duplicated wholesale into Zustand |
| 4 | Preserve incremental delivery | We can migrate store-by-store without a big-bang rewrite or breaking existing routes |
| 5 | Narrow subscriptions | Components subscribe to only the state/actions they use instead of a broad `useApp()` object |
| 6 | Leave room for scoped feature stores | The migration supports future per-editor or per-workspace stores when state needs route- or instance-level isolation |

**Non-Goals**

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Replacing third-party providers such as `QueryClientProvider`, `RouterProvider`, `I18nextProvider`, or Radix providers | Those are framework/library integration points, not app business-state contexts |
| 2 | Moving TanStack Query cache into Zustand | That would duplicate server-state responsibilities and create cache divergence risk |
| 3 | Rewriting the editor state architecture in this initiative | The editor rebuild has its own architecture track and may need scoped stores later |
| 4 | Converting every local `useState` to Zustand | Local component state should stay local unless it is shared or lifecycle-sensitive |
| 5 | Forbidding React context entirely | Context remains acceptable for scoped vanilla store injection when a store must be initialized from props or per-route instance data |

## 3. Background & Context

The root tree in [frontend/src/main.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/main.tsx) currently mounts `AppProvider`, which composes `ThemeProvider`, `AuthProvider`, and `ProfileProvider`. The app then exposes a merged `useApp()` hook as a backwards-compatibility shim. That shim is widely used across routes, account screens, admin screens, billing, studio chat, and media-suite features. The current structure helped split a former monolithic app context, but it still leaves the app with provider-driven global state and a broad consumer API.

There are four app-owned stateful context surfaces in the repo today:

1. `AuthContext` in [frontend/src/app/state/auth-context.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/auth-context.tsx)
2. `ProfileContext` in [frontend/src/app/state/profile-context.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/profile-context.tsx)
3. `ThemeProviderContext` in [frontend/src/app/providers/theme-provider.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/providers/theme-provider.tsx)
4. `AudioPlaybackContext` in [frontend/src/domains/media-suite/audio/state/AudioPlaybackContext.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/domains/media-suite/audio/state/AudioPlaybackContext.tsx)

The most important technical constraint is that this frontend already has a clean server-state layer built on TanStack Query. For example, `ProfileProvider` is effectively a wrapper around `useQuery` plus a mutation helper. We should not replace a good query/cache system with a client-store cache copy just to satisfy the migration headline. The better boundary is:

- Zustand for shared client state, imperative actions, lifecycle orchestration, and persisted UI preferences
- TanStack Query for API-backed resources and mutation invalidation
- Small composition hooks that combine the two when a feature needs both

There is also an important repo convention constraint: the codebase is domain-oriented and already separates `app`, `domains`, and `shared`. Any Zustand migration should respect that structure rather than creating one unbounded dump of state logic.

## 4. Research Summary

**React context re-render behavior**

- React’s `useContext` documentation explicitly states that components reading a context are automatically re-rendered when the provider’s `value` changes, and that `memo` does not block fresh context delivery. React also recommends `useMemo` and `useCallback` only as optimizations around provider values, not as a structural replacement for narrower subscriptions.
- The key implication for this repo is that splitting one large context into several smaller contexts helped, but it did not change the fundamental subscription model. Broad shared objects such as `useApp()` still encourage oversized dependency surfaces.
- Key insight: context is still fine for low-churn framework integration, but it is not the best default for growing app-owned shared state where selectors and independent subscriptions matter.
- Sources:
  - https://react.dev/reference/react/useContext

**Zustand store structure and selector guidance**

- Zustand’s guidance recommends colocating actions with state, using `set`/`setState` consistently, and splitting large applications into slices. The docs also emphasize selector-based reads and `useShallow` for computed selectors that would otherwise cause unnecessary re-renders.
- For this repo, that maps well to a typed app store with explicit slices for session and UI concerns, plus smaller feature stores where isolation is useful. It also argues against preserving a broad `useApp()`-style object API after the migration.
- Key insight: the migration should optimize for selectors first, not just swap context providers for one giant Zustand store.
- Sources:
  - https://zustand.docs.pmnd.rs/learn/guides/flux-inspired-practice
  - https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow
  - https://zustand.docs.pmnd.rs/getting-started/introduction

**Scoped stores, persistence, and lifecycle subscriptions**

- Zustand’s docs recommend vanilla stores plus React context when a store must be initialized from props or needs per-instance scoping. The docs also provide first-party middleware for persistence and for granular subscriptions via `subscribeWithSelector`.
- This matters because “fully to Zustand from React context” should not be interpreted as “never use context again.” For future editor/workspace state that is per-route or per-document, the correct pattern may still be a scoped vanilla store injected by context. For current global theme and audio coordination, though, a plain shared store is enough.
- Key insight: the migration should eliminate app-owned value contexts, but it should explicitly keep the sanctioned scoped-store escape hatch for state that is not truly global.
- Sources:
  - https://zustand.docs.pmnd.rs/learn/guides/initialize-state-with-props
  - https://zustand.docs.pmnd.rs/reference/middlewares/persist
  - https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector

## 5. Options Considered

**Option A: Status quo with minor context cleanup**

Keep the current provider tree and reduce churn by adding more `useMemo`, `useCallback`, and narrower context values where helpful.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low implementation effort, but ongoing cognitive overhead remains |
| Performance | Better than today in spots, but still bound by context-wide subscription semantics |
| Reliability | Low migration risk because nothing structural changes |
| Cost | Lowest short-term engineering cost |
| Reversibility | Fully reversible because almost nothing changes |
| Stack fit | Fits existing code, but not the desired future state model |
| Team readiness | Very high; team already understands the current pattern |

Risks: this likely extends the lifetime of `useApp()` and keeps new features adding to the same broad subscription model. It also makes the eventual migration harder because more code will accumulate on top of the compatibility shim. Likelihood is high because current ergonomics favor `useApp()`.

Open questions: would context-only cleanup be enough for the upcoming editor/client-state work, or would we simply revisit the same decision within one or two milestones?

**Option B: Big-bang rewrite to one global Zustand store**

Replace all app-owned contexts and related hooks at once with a single root Zustand store, migrate all consumers quickly, and delete the provider-based APIs immediately.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High; touches auth, profile, theme, audio, and many route consumers simultaneously |
| Performance | Potentially strong if selectors are done well, but easy to regress if the store becomes monolithic |
| Reliability | Highest migration risk because auth/session flows and profile updates all change together |
| Cost | High engineering and QA cost in a concentrated window |
| Reversibility | Poor; once many files flip simultaneously, rollback is painful |
| Stack fit | Partially fits, but clashes with the repo’s incremental-change style |
| Team readiness | Moderate; the team can learn it, but verification burden is large |

Risks: auth regressions, accidental duplication of query cache into Zustand, and a store that turns into a new version of `useApp()` with different tooling but the same breadth problem. Likelihood is medium to high because the temptation to centralize everything in one object is strong during rewrites.

Open questions: do we have the QA bandwidth to validate sign-in, sign-up, logout, profile edit, admin access, theme persistence, and audio coordination in one cutover?

**Option C: Phased Zustand migration with compatibility facades**

Introduce Zustand incrementally, move low-risk stores first, migrate auth/session next, replace `ProfileContext` with a hook facade over React Query plus Zustand session selectors, and retire `useApp()` only after consumers have narrowed.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Moderate; requires temporary shims but keeps each cut bounded |
| Performance | Good, because selectors can be introduced store-by-store and measured |
| Reliability | Strongest balance of safety and forward motion |
| Cost | Moderate, spread across several shippable phases |
| Reversibility | Good; each phase can be rolled back independently |
| Stack fit | Strong; preserves domain structure and incremental delivery norms |
| Team readiness | High; the migration surface is understandable and testable in pieces |

Risks: the compatibility period may last longer than intended, and some code may continue to use facade hooks unless guardrails are added. Likelihood is medium. Another risk is inconsistency if some features move to Zustand patterns while others keep broad selectors; likelihood is medium.

Open questions: should the compatibility facades continue to expose old method names initially, or should we force consumers to adopt narrower hooks as soon as they move?

**Option D: Partial migration only for feature-local UI state**

Use Zustand only for narrow concerns like theme and audio playback, but leave auth/profile on contexts because they already work.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low to moderate |
| Performance | Some benefit, but the highest-fanout context surface (`useApp`) remains |
| Reliability | Low risk |
| Cost | Lower than full migration |
| Reversibility | High |
| Stack fit | Inconsistent; app would support two long-term patterns for equivalent shared state |
| Team readiness | High |

Risks: this resolves the easiest stores while preserving the main architectural problem, namely the root session/profile provider chain and 49 `useApp()` consumers. Likelihood is high.

Open questions: if auth/profile remain on context, is the team actually getting the simplification it wants, or just moving the easiest code and calling the migration done?

## 6. Recommendation

**We recommend Option C: Phased Zustand migration with compatibility facades.**

This is the best fit because it achieves the actual objective, which is to stop using app-owned React context as the default shared-state mechanism, without collapsing server state and client state into the same store or taking on big-bang auth risk. It is better than the status quo because it replaces broad provider subscriptions with selector-based consumption. It is better than the partial migration option because it does not leave `useApp()` as the long-term center of gravity. It is better than the big-bang rewrite because auth/session and profile flows are too business-critical to change all at once without a migration seam.

The recommendation depends on four assumptions:

1. TanStack Query remains the canonical cache for API-backed resources.
2. The team is willing to migrate consumers incrementally instead of demanding immediate provider deletion.
3. Future scoped stores, especially in the editor, are allowed to use React context only as a store-instance injector when props-based initialization is required.
4. We add guardrails so new app-owned state contexts are not introduced during the migration.

The recommendation would change if one of two conditions became true: either the frontend moves to an SSR-heavy architecture that requires different store lifecycle rules, or the team decides that profile data must be globally mutable offline client state rather than query-backed server state.

## 7. Implementation Plan

**Phase 1: Foundations and migration guardrails**

Goal: introduce Zustand infrastructure and the target state boundaries without changing user-visible behavior.

Done criteria: `zustand` is added to the frontend, store conventions exist, and a migration document plus guardrails are in place.

Deliverables:

- [ ] Add `zustand` to `frontend/package.json`
- [ ] Create `frontend/src/app/store/` for app-wide stores and selectors
- [ ] Define store conventions:
  - global app store for session/app UI slices
  - feature stores for isolated concerns
  - TanStack Query remains source of truth for server state
  - selector-first consumption; avoid full-store subscriptions
- [ ] Add a lightweight bootstrap component or module for one-time store initialization side effects
- [ ] Add a lint rule, repo check, or review checklist item forbidding new app-owned `createContext` state containers outside approved UI primitive or scoped-store patterns
- [ ] Add test helpers for resetting stores between tests

Dependencies: none beyond normal package install and test setup.

Risks and detection: the main risk is adopting inconsistent store patterns early. Detect via code review and a short store guideline in the repo. Another risk is hidden test pollution from module-state stores; detect via failing unit tests or order-dependent behavior.

Rollback plan: remove the added package and scaffolding before any consumer migrations land.

**Phase 2: Migrate low-risk shared UI state**

Goal: prove the pattern on state with minimal business risk.

Done criteria: theme and audio playback no longer depend on app-owned React context providers.

Deliverables:

- [ ] Replace `ThemeProviderContext` with a Zustand-backed theme store
- [ ] Persist theme via Zustand `persist` middleware or an equivalent explicit storage adapter
- [ ] Update [frontend/src/shared/ui/theme-toggle.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/shared/ui/theme-toggle.tsx) and related consumers to use selectors
- [ ] Replace `AudioPlaybackContext` with a small feature store under `domains/media-suite/audio/state`
- [ ] Remove `AudioPlaybackProvider` from [frontend/src/domains/creation/chat/ui/ContentWorkspace.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/domains/creation/chat/ui/ContentWorkspace.tsx)
- [ ] Verify theme persistence and single-active-audio-player behavior in browser tests or focused manual QA

Dependencies: Phase 1 conventions and test utilities.

Risks and detection: theme hydration or DOM-class sync could drift, especially because the repo already depends on `next-themes`. Detect by refreshing the app across theme switches and checking the initial paint class. Audio playback could fail to stop previous players; detect with manual multi-player interaction tests.

Rollback plan: keep temporary wrapper hooks that can redirect consumers back to the old implementations until the provider deletions are stable.

**Phase 3: Migrate auth and session orchestration**

Goal: move Firebase auth session state and auth actions into Zustand without breaking existing sign-in and logout flows.

Done criteria: auth state is sourced from a Zustand store and no route depends on `AuthProvider`.

Deliverables:

- [ ] Create an app session store for:
  - `user`
  - `authLoading`
  - `backendReady`
  - auth actions (`signIn`, `signUp`, `signInWithGoogle`, `logout`)
- [ ] Move `onAuthStateChanged` subscription logic into store initialization or bootstrap code
- [ ] Preserve query cache clearing on logout/session loss
- [ ] Convert [frontend/src/domains/app/auth/hooks/use-authenticated-fetch.ts](/Users/ken/Documents/workspace/ContentAI/frontend/src/domains/app/auth/hooks/use-authenticated-fetch.ts) to read from Zustand selectors instead of `useApp()`
- [ ] Introduce narrow selectors such as `useCurrentUser()`, `useIsAuthenticated()`, and `useAuthActions()` for new code
- [ ] Keep a temporary compatibility `useAuth()` or `useApp()` facade backed by Zustand while consumer migrations are in progress
- [ ] Remove `AuthProvider` from the app tree once all auth consumers have moved

Dependencies: Phase 1 foundations. Phase 2 is helpful but not required.

Risks and detection: auth lifecycle bugs are the highest-risk part of the migration. Detect via explicit regression checks for sign-in, sign-up, Google sign-in, logout, protected-route redirects, and admin route access. Watch for duplicate `onAuthStateChanged` subscriptions under Strict Mode.

Rollback plan: restore the previous `AuthProvider` implementation behind the same hook surface if the Zustand session bootstrap proves unstable.

**Phase 4: Retire `ProfileContext` without duplicating server cache**

Goal: remove profile context while preserving TanStack Query as the canonical source of profile data.

Done criteria: `ProfileProvider` is gone and profile consumers use a query/store composition hook surface instead of context.

Deliverables:

- [ ] Replace `ProfileContext` with:
  - a dedicated `useProfileQuery()` hook for reading profile data
  - a `useUpdateProfile()` mutation hook
  - optional small Zustand selectors for client-only derived flags if needed
- [ ] Rework `useApp()` consumers to use narrower hooks instead of a single aggregate object
- [ ] Ensure admin gating, OAuth flags, and profile refresh behavior remain correct
- [ ] Remove `ProfileProvider` from [frontend/src/app/state/app-provider.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/app-provider.tsx)

Dependencies: Phase 3 session store, because profile queries depend on authenticated user/session readiness.

Risks and detection: the risk is accidentally duplicating profile state in both Query and Zustand. Detect by enforcing a rule that server payloads stay query-owned unless there is a documented client-side reason to mirror a subset. Another risk is breaking `backendReady` gating and causing premature profile fetches; detect through auth/profile integration tests.

Rollback plan: keep the old `ProfileProvider` implementation available until profile consumers have been verified on the new hook surface.

**Phase 5: Delete compatibility shims and lock the new model**

Goal: finish the migration and prevent regressions back to context-based app state.

Done criteria: `useApp()` is removed, app-owned state contexts are deleted, and new shared state follows the documented Zustand pattern.

Deliverables:

- [ ] Migrate all 49 current `useApp()` call sites to narrow hooks/selectors
- [ ] Delete [frontend/src/app/state/app-context.tsx](/Users/ken/Documents/workspace/ContentAI/frontend/src/app/state/app-context.tsx) compatibility surface
- [ ] Delete obsolete provider files and imports
- [ ] Update frontend contribution docs with the new state boundary rules
- [ ] Add a CI check or lint exception list so only approved context usage remains

Dependencies: Phases 2 through 4 complete.

Risks and detection: the main risk is a long tail of hidden consumers or stale imports. Detect with `rg`-based checks in CI and TypeScript failures after file deletion.

Rollback plan: because previous phases are independently shippable, rollback should happen by restoring the last stable shim rather than resurrecting the full provider tree from scratch.

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Auth lifecycle regressions during session-store migration | Medium | High | Migrate auth in its own phase, preserve old hook surface temporarily, add focused regression testing |
| 2 | Duplicating TanStack Query cache in Zustand | Medium | High | Make Query the explicit source of truth for API-backed resources; require justification for mirrored data |
| 3 | Replacing context with one oversized Zustand API and recreating `useApp()` in another form | Medium | Medium | Enforce selector-first hooks and discourage full-store reads |
| 4 | Store module state leaking between tests | Medium | Medium | Add reset helpers and test setup conventions in Phase 1 |
| 5 | Theme persistence or first-paint class drift | Medium | Medium | Validate refresh behavior and class synchronization across persisted themes |
| 6 | Compatibility shim lingers and slows final cleanup | High | Medium | Track remaining `useApp()` consumers as a migration metric and block new usages |
| 7 | Future editor work needs scoped stores and the team misreads the migration as “context is banned” | Medium | Medium | Document the allowed scoped vanilla-store plus context pattern explicitly |

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| Remove app-owned React context for shared state | Count of app-owned state contexts in `app` and `domains` | 4 | 0 global/shared business-state contexts remaining | `rg` for `createContext` in approved app/domain paths |
| Retire broad app shim | `useApp()` call sites | 49 | 0 | `rg "useApp\\(" frontend/src` |
| Adopt selector-based access | Consumers reading full aggregate app state object | 49 via `useApp()` | 0 | Code search and review of new hooks |
| Preserve server-state boundary | Query-backed resources mirrored wholesale into Zustand | Unclear today, but profile context wraps Query | 0 intentional whole-resource mirrors | Architecture review and store inventory |
| Prove incremental delivery | Migration phases shipped without reverting the whole app tree | 0 | 5 phases independently shippable | Release notes / merged milestones |
| Prevent new context creep | New app-owned state contexts introduced after Phase 1 | Not tracked | 0 | CI/lint rule plus code review checklist |

Leading indicators:

- `zustand` is installed and store test helpers exist
- theme and audio provider removals land without user-facing regressions
- `useApp()` call-site count trends downward release over release

Lagging indicators:

- root provider tree no longer includes `AuthProvider`, `ProfileProvider`, or custom theme/audio state providers
- new shared client state is added as Zustand stores rather than contexts

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Should theme stay custom in Zustand, or should the app standardize on `next-themes` given it is already installed and used by the toast layer? | Frontend maintainers | Before Phase 2 | Open |
| 2 | Do we want one app store with slices for session/UI, or separate app-level stores per concern as long as selectors stay narrow? | Frontend architecture owner | Before Phase 1 implementation | Open |
| 3 | Should `useApp()` be preserved as a temporary facade over Zustand for one migration window, or should we force consumer rewrites immediately? | Frontend maintainers | Before Phase 3 | Open |
| 4 | Will the editor rebuild require per-project scoped stores soon enough that we should establish the scoped vanilla-store pattern during this initiative? | Editor owner | Before Phase 5 | Open |

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Status quo with context cleanup | Improves symptoms without changing the underlying subscription and coupling model |
| Big-bang rewrite to one store | Too risky for auth/profile flows and too hard to roll back cleanly |
| Feature-local-only migration | Leaves the main `useApp()` and root provider problem in place |
