# Usability Fixes — Plan

> **Date:** 2026-04-08
> **Status:** Draft
> **Deciders:** Kenneth

## 1. Problem Statement

ReelStudio has 30+ usability defects across every major feature. These are not edge cases — they are the default experience: deleting a session orphans editor projects, the editor ignores server changes without a page refresh, mutations silently fail with no user feedback, stale URL params leave users staring at blank screens, and disabled buttons offer no explanation. The app works if the user follows the happy path perfectly, but any deviation (deleting, navigating back, opening a stale URL, encountering a network error) produces confusing, non-deterministic behavior.

More critically, the codebase has **no structural guardrails** preventing these defects from recurring. There is no shared mutation feedback pattern, no error boundary granularity, no navigation guards, and no convention for cache cleanup after deletes. Every new feature independently decides how to handle (or ignore) errors, loading states, and cache invalidation — which means every new feature is likely to ship with the same class of bugs.

If nothing is done, each new feature will add more defects, and early testers will encounter broken states that only resolve with page refreshes.

## 2. Goals & Non-Goals

**Goals**

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Every mutation gives the user clear feedback (loading, success, or error) | No silent failures; every action has a visible outcome |
| 2 | Every delete operation leaves the UI in a consistent state | No stale cache, no orphaned views, navigation away from deleted resources |
| 3 | Stale URL params are handled gracefully | Bookmarking a deleted resource shows "not found", not a blank screen |
| 4 | Editor reflects server-side changes without page refresh | AI-driven changes appear within 15 seconds |
| 5 | Disabled buttons explain why they are disabled | Tooltip or adjacent text on every disabled interactive element |
| 6 | Structural patterns prevent recurrence | Shared mutation wrapper, error boundaries, cache cleanup conventions |

**Non-Goals**

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Undo/restore for deleted resources | Pre-production — not worth the complexity |
| 2 | Real-time collaboration (WebSocket sync) | Polling is sufficient for single-user |
| 3 | Soft delete infrastructure | No production users — hard delete is appropriate |
| 4 | Optimistic delete UI | Adds rollback complexity; server round-trip is fast enough |
| 5 | Full loading skeleton design system | Consolidate to shared primitives, but don't redesign every skeleton |

## 3. Background & Context

### Current Architecture

**Editor state lifecycle:**
- `EditorRoutePage` fetches a project via `fetchAndOpen` and passes it as a prop to `EditorLayout`.
- `useEditorProjectPoll` loads the project into local reducer state via `store.loadProject(project)` — but only when `project.id` changes (not when content changes).
- `useEditorAutosave` debounces edits (500ms) and runs a 30s heartbeat, PATCHing `/api/editor/:id`. On success it invalidates `editorProjects()` (the list key) but not `editorProject(id)` (the per-project key).
- The poll query (`useEditorProjectPoll`) only runs `refetchInterval` while `hasPlaceholders === true`. Once all placeholders resolve, polling stops entirely.
- On unmount, pending debounced saves fire via `queueSave` (fire-and-forget) rather than `flushSave` (awaited).
- Dead code: `useEditorProject.ts` defines a second save path that is never imported.

**Delete cascade paths (DB schema):**
- `project` → `chat_session` (cascade) → `chat_messages` (cascade) → `message_attachments` (cascade)
- `chat_session` → `chat_session_content` (cascade) — but `generated_content` itself is NOT cascaded
- `edit_projects.generatedContentId` → `generated_content.id` (`onDelete: "set null"`) — edit projects survive content deletion
- `edit_projects.userId` → `users.id` (`onDelete: "cascade"`) — only cascade is from user deletion

**TanStack Query invalidation:**
- `invalidateEditorProjectsQueries` — invalidates `["api","editor","projects"]` (list only)
- `invalidateChatSessionsQueries` — invalidates `["api","chat-sessions"]` prefix
- No centralized "delete session + cleanup related queries" helper exists
- `removeQueries` is used exactly once (auth logout) — never after entity deletes

### Why These Bugs Keep Happening — Structural Gaps

The defects in this plan are not one-offs. They stem from 7 missing structural patterns:

**Gap 1: No shared mutation feedback pattern.** There is no `useMutation` wrapper or convention. Of ~26 mutation files, roughly 60% emit zero user feedback on success or failure. Three competing patterns coexist: toast-only, inline state + toast, and complete silence. The most dangerous instance is `useEditorAutosave` — a failed autosave is silently dropped, and the user's `isDirty` amber indicator provides no distinction between "saving" and "save failed."

**Gap 2: Single global error boundary.** One `ErrorBoundary` wraps the entire app in `__root.tsx`. A render error in any child — a bad clip in the editor, a broken admin panel — takes down the entire application and shows a full-screen error card. There are no route-level or feature-level boundaries.

**Gap 3: No navigation guards.** There is no `beforeunload` handler anywhere. The editor's `isDirty` indicator is purely cosmetic — browser Back, tab close, or sidebar nav all silently abandon unsaved work. No other feature (profile, system config, order form) has any dirty-state detection at all.

**Gap 4: `removeQueries` never used after entity deletes.** After deleting a session/project, only `invalidateQueries` is called (triggering a refetch). But the entity no longer exists — a refetch either 404s or returns stale data from cache. The correct pattern is `removeQueries` for the deleted entity + `invalidateQueries` for lists.

**Gap 5: No stale-URL recovery.** When URL search params (`?sessionId=`, `?projectId=`) reference a deleted entity, the app renders a blank/loading state with no "not found" message and no URL cleanup. The stale param poisons subsequent navigation.

**Gap 6: Disabled buttons don't explain themselves.** Multiple buttons across editor, audio, and chat are conditionally disabled via `disabled={condition}` with no `title` attribute or tooltip. The user sees a greyed-out button and must guess why.

**Gap 7: Fragmented loading primitives.** Three loading primitives exist (`<Spinner>`, `<Skeleton>`, raw `<Loader2>`). `<Spinner>` is used once. `<Loader2>` is imported directly in 39 files with varying sizes. There is no `<PageLoader>` or layout-aware loading component.

## 4. Research Summary

**TanStack Query: `removeQueries` vs `invalidateQueries` after deletion**
- `invalidateQueries` marks queries as stale and triggers refetch for active queries. Best when the underlying data still exists but has changed.
- `removeQueries` purges the cache entry entirely. Best after deletes — the resource no longer exists, so there is nothing to refetch. If a component tries to use the removed query, it goes into a fresh loading state rather than showing stale data.
- For deletes, the recommended pattern is: `removeQueries` for the deleted entity's individual key + `invalidateQueries` for any list that included it.
- Source: [TanStack/query Discussion #3169](https://github.com/TanStack/query/discussions/3169)

**Cascade deletion UX patterns**
- In pre-production SaaS apps, hard cascade delete is standard. Soft delete adds complexity (every query needs `WHERE deleted_at IS NULL`) and is a production concern for data recovery.
- When deleting a parent that owns child resources, best practice is a confirmation dialog that explicitly lists what will be removed.
- Source: [Brandur — Soft Deletion Probably Isn't Worth It](https://brandur.org/soft-deletion)

**Optimistic UI for destructive actions**
- Consensus: do NOT use optimistic updates for deletes. The cost of showing a deleted item flash back on error is worse than a brief loading state. Confirmation dialog + disable trigger + loading indicator is the right pattern.
- Source: [LogRocket — Understanding Optimistic UI](https://blog.logrocket.com/understanding-optimistic-ui-react-useoptimistic-hook/)

## 5. Full Defect Catalog

### A. Delete & Cache Invalidation Defects

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-01 | `useDeleteChatSession` only invalidates session list, not individual session or drafts cache | `use-chat-sessions.ts:37-46` | High |
| D-02 | `useDeleteProject` doesn't invalidate session list — sidebar shows ghost sessions | `use-projects.ts:62-71` | High |
| D-03 | Editor `deleteProject` has no navigation guard for the currently-open project; autosave 404-loops silently | `EditorRoutePage.tsx:302-308` | Critical |
| D-04 | `useDeleteProject` / `useDeleteChatSession` have no `onError` — user sees nothing on failure | `use-projects.ts`, `use-chat-sessions.ts` | High |
| D-05 | Deleting a session orphans `generated_content`, `edit_projects`, and `queue_items` | DB schema — no FK cascade | High |
| D-06 | No delete confirmation dialog showing what will be cascade-removed | N/A — dialog uses generic confirm | Medium |
| D-07 | Delete buttons in `ProjectSidebarDeleteDialogs` lack `isPending` guard — double-click fires duplicate requests | `ProjectSidebarDeleteDialogs.tsx:45-76` | Medium |
| D-08 | `EditorRoutePage` delete button has no pending state — rapid-click race | `EditorRoutePage.tsx:175-181` | Medium |

### B. Editor Reactivity & Autosave Defects

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-09 | Autosave `onSuccess` invalidates list key only, not per-project key — editor ignores server changes | `useEditorAutosave.ts:61` | High |
| D-10 | Editor poll disabled when no placeholders — AI/sync changes invisible without refresh | `useEditorProjectPoll.ts:40` | High |
| D-11 | 30s heartbeat fires unconditionally even when `isDirty === false` | `useEditorAutosave.ts:129-143` | Low |
| D-12 | Unmount save uses fire-and-forget `queueSave` instead of awaited `flushSave` — last edit may be lost | `useEditorAutosave.ts:78-93` | Medium |
| D-13 | Autosave mutation has no `onError` handler — silent failure, user sees amber `isDirty` forever | `useEditorAutosave.ts:51-63` | Critical |
| D-14 | `useEditorProject.ts` is dead code with a duplicate save path | `useEditorProject.ts` (entire file) | Low |
| D-15 | `fetchAndOpen` in `EditorRoutePage` can be called concurrently on rapid re-renders (no abort/guard) | `EditorRoutePage.tsx:256-287` | Medium |

### C. Stale URL & Navigation Defects

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-16 | `?sessionId=<deleted-id>` shows blank state with no "not found" message; stale param poisons navigation | `useChatLayout.ts:33-36` | High |
| D-17 | `?projectId=<deleted-id>` shows permanent "select a project" blank state | `useChatLayout.ts:83-95` | High |
| D-18 | Queue `?projectId` filter can reference a deleted project — shows empty queue with no explanation | `QueueView.tsx:49-53` | Medium |
| D-19 | Editor `?projectId=<deleted-uuid>` — no error state after 404, shows project grid with stale URL | `EditorRoutePage.tsx:256-265` | Medium |
| D-20 | `deleteProject` mutation in chat leaves stale `?projectId` and `?sessionId` in URL | `useProjectSidebar.ts:110-123` | High |
| D-21 | `createNewDraft` navigates back to `/studio/editor` without indicating which project was created | `useEditorLayoutMutations.ts:46-58` | Low |

### D. Missing Feedback (Toast/Loading)

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-22 | `useAttachMusic` — no toast on success or error | `use-attach-music.ts` | Medium |
| D-23 | `useDeleteAsset` — no toast; unhandled promise rejection on failure | `use-delete-asset.ts` | High |
| D-24 | `useUpdateAssetMetadata` (volume slider) — silent failure on save error | `use-update-asset-metadata.ts` | Low |
| D-25 | `useGenerateReel` — no success toast after job queued | `use-generate-reel.ts` | Low |
| D-26 | `useSendToQueue` — zero user feedback on success or error | `use-send-to-queue.ts` | Medium |
| D-27 | `handlePublish` catch block closes dialog silently, no error message | `useEditorTransport.ts:89-101` | High |
| D-28 | `uploadProjectThumbnail` error swallowed in try/finally with no catch | `EditorRoutePage.tsx:85-96` | Medium |
| D-29 | `handleConfirmDeleteProject` debug-logs error but doesn't surface to user | `useProjectSidebar.ts:110-123` | Medium |

### E. Loading & Error State Defects

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-30 | `generate.tsx` — API error shows permanent loading skeleton (no error branch) | `generate.tsx:31-39` | High |
| D-31 | `MediaLibraryModal` — loading text says "uploading" when it's actually loading the library | `MediaLibraryModal.tsx:36` | Low |
| D-32 | `MediaLibraryModal` — no error state; blank modal on fetch failure | `MediaLibraryModal.tsx:33-58` | Medium |
| D-33 | `DraftsList` / `DraftDetail` — asset fetch failure silently hides badges/players | `DraftsList.tsx:26`, `DraftDetail.tsx:40` | Low |
| D-34 | `QueueView` detail panel — deleted item renders nothing (no "not found" message) | `QueueView.tsx:291-313` | Medium |
| D-35 | `DiscoverPage` — niches loading shows "no reel selected" instead of skeleton | `discover.tsx:38-45` | Medium |
| D-36 | `ContentWorkspace` video tab — shows "no content" message during loading (no skeleton) | `ContentWorkspace.tsx:216-227` | Low |

### F. Disabled State & Empty State Defects

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-37 | Chat input disabled during streaming with no tooltip explaining why | `ChatInput.tsx` / `ChatPanel.tsx:266` | Medium |
| D-38 | Editor "Publish" button disabled during autosave with no tooltip | `EditorToolbar.tsx:323-328` | Low |
| D-39 | Editor "New Draft" button disabled during creation with no tooltip | `EditorToolbar.tsx:304-311` | Low |
| D-40 | Voiceover "Generate" button disabled when voices loading with no explanation | `VoiceoverGenerator.tsx:228-231` | Medium |
| D-41 | Usage limit blocks chat input but "New Session" button in sidebar is not disabled — user discovers limit only after navigating | `ProjectSidebarUsage.tsx:74` | Medium |

### G. Form State & Race Conditions

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-42 | Caption transcript editor — unsaved text silently lost on clip deselection | `CaptionTranscriptEditor.tsx:17-21` | Medium |
| D-43 | Editor dirty state has no `beforeunload` guard — browser Back/tab close loses last edit | `useEditorTransport.ts:103-114` | Medium |
| D-44 | `NicheDetailView` bulk delete — `isPending` flips false mid-batch, re-enabling button | `NicheDetailView.tsx:138-146` | Low |
| D-45 | `NicheScrapingControls` uses raw `useState` + `authenticatedFetch` outside TanStack Query — stale data invisible to cache | `NicheScrapingControls.tsx` | Low |

### H. Inline Cache Violations (bypass centralized helpers)

| ID | Defect | File | Severity |
|----|--------|------|----------|
| D-46 | `useUpdateCaptionDoc` — inline `invalidateQueries` call | `useUpdateCaptionDoc.ts:31` | Low |
| D-47 | `useTranscription` — three inline `invalidateQueries` calls for caption keys | `useTranscription.ts:28-36` | Low |
| D-48 | `EditorLayout` — inline `invalidateQueries` embedded in JSX render tree | `EditorLayout.tsx:84` | Medium |
| D-49 | `order-form.tsx` — freeform query key `["api","users","list",url]` not in `query-keys.ts` | `order-form.tsx:124` | Low |

## 6. Options Considered

### Option A: Status Quo (Do Nothing)

Users continue encountering stale state, silent failures, and blank screens. Each new feature ships with the same class of bugs because there are no guardrails.

| Dimension | Assessment |
|-----------|------------|
| Complexity | None |
| Reliability | Poor — 45 known defects, no prevention |
| Cost | Zero |

### Option B: Fix Individual Defects Only

Fix each defect from the catalog one by one without introducing structural patterns. Fastest time to "bugs fixed" but doesn't prevent recurrence.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — many small changes |
| Reliability | Improved short-term, but new features will reintroduce the same classes of bugs |
| Cost | ~8-10 hours |
| Reversibility | Fully reversible |

### Option C: Structural Patterns + Defect Fixes (Recommended)

Introduce the missing structural guardrails first (shared mutation wrapper, error boundaries, stale-URL recovery, delete-cleanup convention), then fix individual defects using those patterns. More upfront work, but every subsequent feature inherits the guardrails.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — new shared infrastructure + individual fixes |
| Reliability | High — structural prevention of recurrence |
| Cost | ~12-16 hours across 5 phases |
| Reversibility | Each phase independently shippable; DB changes require `db:reset` |
| Stack fit | Extends existing `query-invalidation.ts` convention; uses standard React patterns |

## 7. Recommendation

**We recommend Option C: Structural Patterns + Defect Fixes.**

Option B would fix all 45 defects but provide no guardrails — the next feature would likely ship with the same silent-failure and stale-cache bugs. Option C costs ~50% more upfront but pays back immediately: once the shared mutation wrapper exists, every new mutation gets feedback for free. Once route-level error boundaries exist, a rendering bug in one feature no longer crashes the entire app.

Key assumption: we are pre-production and can freely `db:reset` and refactor aggressively.

Condition that would change this recommendation: if there are fewer than 2 weeks before the first external users, do Option B first and backfill patterns later.

## 8. Implementation Plan

### Phase 1: Structural Guardrails

**Goal:** Introduce the shared patterns that prevent recurrence. **Done when:** the patterns exist and are documented; no features are migrated yet.

**Deliverables:**

- [ ] **Shared mutation feedback convention** — Establish a pattern in `query-invalidation.ts` or a new `mutation-helpers.ts` for post-mutation feedback. Convention: every mutation that the user triggers (not autosave) should show `toast.error` on failure. Success toasts are optional per-feature. Document the convention in a comment header. This is a convention + documentation change, not a wrapper library — keep it simple.

- [ ] **Route-level error boundaries** — Add `ErrorBoundary` wrappers around the major route groups: Studio (editor, generate, queue, discover), Admin, and Auth. Each boundary catches render errors within its route and shows a scoped error message ("Something went wrong in the editor") with a retry button — instead of the current full-app crash. Use React's built-in `ErrorBoundary` pattern (class component or `react-error-boundary` library).

- [ ] **Stale-URL recovery pattern** — Add a shared `useResolvedParam<T>` hook (or inline pattern) that: (1) takes a URL param + a query result, (2) if the param exists but the query returns 404/not-found, clears the param from the URL and shows a toast "X not found". Apply to `sessionId` and `projectId` in `useChatLayout`, and `projectId` in `EditorRoutePage`.

- [ ] **Delete cache cleanup convention** — Add `removeDeletedEntityQueries(queryClient, queryKey)` helper to `query-invalidation.ts`. Convention: after a delete mutation, call `removeQueries` for the entity's individual key, then `invalidateQueries` for any lists. Document in the module header.

- [ ] **Disabled button convention** — Establish a rule: every `disabled` prop must be accompanied by a `title` attribute explaining why. No code changes in this phase — just document the convention in CLAUDE.md so future development follows it.

**Rollback:** Revert all. These are additive patterns with no breaking changes.

---

### Phase 2: Delete Flow Fixes (Defects D-01 through D-08)

**Goal:** Every delete operation leaves the UI in a consistent, predictable state. **Done when:** deleting a session/project cleans up cache, navigates away from deleted resources, shows error on failure, and disables trigger while pending.

**Deliverables:**

- [ ] **D-01: `useDeleteChatSession`** — Use `removeQueries` for the deleted session's individual key and drafts key. Keep existing list invalidation.

- [ ] **D-02: `useDeleteProject`** — Add `invalidateChatSessionsQueries` to `onSuccess` (project cascade-deletes sessions).

- [ ] **D-03: Editor `deleteProject`** — In `onSuccess`, if deleted project is active, call `setActiveProject(null)` and clear URL params. Add `onError` with `toast.error`.

- [ ] **D-04: Delete error feedback** — Add `onError: () => toast.error(t("delete_failed"))` to both `useDeleteChatSession` and `useDeleteProject`.

- [ ] **D-07 & D-08: Pending guards on delete buttons** — Forward `isPending` from delete mutations to dialog action buttons and editor delete button. Disable while pending.

- [ ] **D-20: Chat project delete navigation** — After deleting the selected project, clear `?projectId` and `?sessionId` from URL.

**Rollback:** Revert frontend changes.

---

### Phase 3: Resource Lifecycle & Cascade Cleanup (Defects D-05, D-06)

**Goal:** Deleting a session also cleans up exclusively-owned content and editor projects. **Done when:** no orphaned resources survive session deletion (unless user-edited).

**Deliverables:**

- [ ] **D-05: Backend cascade delete service** — Before deleting a session, query `chat_session_content` to find associated content IDs. For each, check exclusive ownership (not linked to other sessions). If exclusive: delete `generated_content` (FK `SET NULL` on `edit_projects`). Then delete orphaned `edit_projects` where `generatedContentId IS NULL` and `userHasEdited = false`.

- [ ] **D-06: Delete preview endpoint** — `GET /api/chat/sessions/:id/delete-preview` returning `{ messages, generatedContent, editorProjects }` counts. Frontend shows these in the confirmation dialog.

- [ ] **Frontend: Invalidate editor queries after session delete** — Add `invalidateEditorProjectsQueries` call to `useDeleteChatSession.onSuccess`.

**Rollback:** Revert backend service + frontend dialog. Schema unchanged.

---

### Phase 4: Editor Reactivity & Autosave (Defects D-09 through D-15)

**Goal:** Editor picks up server changes; autosave is efficient, reliable, and fails loudly. **Done when:** AI changes appear in open editor within 15s; heartbeat is idle-aware; unmount saves are not lost; autosave errors are surfaced.

**Deliverables:**

- [ ] **D-09: Autosave invalidation** — Add `invalidateEditorProjectQuery(queryClient, projectId)` helper and call from autosave `onSuccess`.

- [ ] **D-10: Background poll without placeholders** — Change `refetchInterval` to `hasPlaceholders ? pollIntervalMs : 15_000`.

- [ ] **D-11: Guard heartbeat with dirty check** — Add `isDirtyRef` and wrap heartbeat callback: `if (!isDirtyRef.current) return;`

- [ ] **D-12: Unmount save reliability** — Add `beforeunload` listener that calls `flushSave`. For SPA navigation, keep current `queueSave` on unmount (mutation will still fire if component unmounts within the same SPA).

- [ ] **D-13: Autosave error handler** — Add `onError` to save mutation: on 404 → toast "project deleted", stop heartbeat; on 409 → toast "version conflict, please refresh"; on other → toast generic save error.

- [ ] **D-14: Remove dead code** — Delete `useEditorProject.ts`.

- [ ] **D-15: `fetchAndOpen` race guard** — Add an abort controller or ref guard to prevent concurrent `fetchAndOpen` calls.

**Rollback:** Revert frontend changes.

---

### Phase 5: Feedback, Loading, & Polish (Defects D-16 through D-49)

**Goal:** Every remaining defect is addressed. **Done when:** no mutations are silent; no loading states show wrong copy; no disabled buttons lack explanation.

**Deliverables:**

- [ ] **D-16, D-17: Stale URL recovery** — Apply the `useResolvedParam` pattern from Phase 1 to `useChatLayout` for both `sessionId` and `projectId`. Show "Session not found" / "Project not found" toast and clear params.

- [ ] **D-18, D-19: Queue and editor stale URL** — Apply same pattern to `QueueView` project filter and `EditorRoutePage` project param.

- [ ] **D-22 through D-29: Missing toast feedback** — Add `onError: () => toast.error(...)` to all identified mutations. Add success toasts where the action is user-initiated and the outcome isn't otherwise visible (D-25, D-26).

- [ ] **D-30: `generate.tsx` error state** — Add `isError` branch showing an error message with retry button.

- [ ] **D-31: Media library loading copy** — Change `t("media_library_uploading")` to correct loading translation key.

- [ ] **D-32 through D-36: Missing error/loading states** — Add `isError` branches and loading skeletons to `MediaLibraryModal`, `DraftsList`/`DraftDetail`, `QueueView` detail, `DiscoverPage` niches, and `ContentWorkspace` video tab.

- [ ] **D-37 through D-41: Disabled button explanations** — Add `title` attributes to all disabled buttons explaining the condition (streaming, saving, loading voices, usage limit).

- [ ] **D-42: Caption transcript dirty guard** — Either debounce-save on every keystroke (like the editor autosave pattern) or prompt before clip deselection when text has changed.

- [ ] **D-43: `beforeunload` for editor** — Already addressed in Phase 4 D-12.

- [ ] **D-46 through D-49: Inline cache violations** — Move caption invalidation calls into `query-invalidation.ts` helpers. Register the `order-form.tsx` query key in `query-keys.ts`.

**Rollback:** Revert individual changes. All frontend-only.

## 9. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Cascade delete service accidentally deletes shared content | Medium | High | Exclusive-ownership check + unit tests for shared-content scenarios |
| 2 | 15s background poll increases server load | Low | Low | Single lightweight GET per open editor tab; lower rate than current 30s heartbeat |
| 3 | Route-level error boundaries catch too aggressively, hiding bugs during dev | Low | Medium | Only catch render errors; mutations and effects still throw normally. Keep console logging. |
| 4 | `beforeunload` listener blocks tab close annoyingly | Medium | Low | Only fire when `isDirty` is truly true and unsaved edits exist. Clear the listener on successful save. |
| 5 | Phase 5 scope creep — 20+ small fixes becomes a long tail | Medium | Medium | Timebox Phase 5. Ship in batches by feature area (chat, editor, audio, admin). |
| 6 | Shared mutation convention adds boilerplate without value | Low | Low | Convention is lightweight (add `onError` to mutations), not a wrapper/HOC. No abstraction overhead. |

## 10. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| Mutation feedback | Mutations with zero user feedback | ~15 mutations | 0 | Code audit: every `useMutation` has `onError` handler |
| Cache consistency | Stale cache entries after delete | Multiple paths | 0 | QA: delete session/project, verify no ghost entries |
| Stale URL recovery | Blank screens from stale URL params | 4 paths | 0 | Navigate to bookmarked deleted-entity URLs |
| Editor reactivity | Time for server change to appear | Infinite (refresh) | < 15s | Open editor tab A, change via chat tab B |
| Autosave efficiency | Unnecessary PATCHes/min (idle editor) | 2/min | 0/min | Network tab observation |
| Error containment | Feature error crashes entire app | Always | Never | Throw in editor component, verify only editor route shows error |
| Disabled button clarity | Disabled buttons without explanation | 5+ | 0 | Visual audit of all disabled states |

## 11. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Should project-level delete also cascade-delete generated content, or only session-level? | Kenneth | Before Phase 3 | Open |
| 2 | For preserved editor projects (`userHasEdited = true`), separate section or mixed into main list? | Kenneth | Before Phase 3 | Open |
| 3 | Is 15s poll acceptable for editor reactivity, or do we need SSE for the editor? | Kenneth | Before Phase 4 | Open |
| 4 | Should we adopt `react-error-boundary` library or write a minimal class component? | Kenneth | Before Phase 1 | Open |
| 5 | Do we want a `beforeunload` prompt on ALL forms (profile, admin config) or just the editor? | Kenneth | Before Phase 4 | Open |

## 12. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Status Quo | 45 known defects, no prevention of new ones |
| Fix Individual Defects Only | Fixes symptoms without structural guardrails; next feature ships same bugs |
| WebSocket-based editor sync | Over-engineered for single-user pre-production |
| Soft delete for all resources | Pre-production — adds query complexity for a benefit not yet needed |
| Optimistic delete UI | Consensus against optimistic updates for destructive actions |
| Global mutation wrapper HOC | Over-abstraction; a convention + `onError` on each mutation is simpler |
