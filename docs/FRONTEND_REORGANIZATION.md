# Frontend Reorganization Plan

> **Scope:** `frontend/src/` — full structural overhaul for long-term maintainability.
> **Backwards compatibility:** Not a concern. Every file/import path is fair game to change.
> **Goal:** A codebase where a competent engineer can find anything in <30 seconds, change anything without fear, and delete a feature without leaving corpses.

---

## Table of Contents

0. [Progress Update (March 29, 2026)](#0-progress-update-march-29-2026)
1. [Current Problems](#1-current-problems)
2. [New Directory Structure](#2-new-directory-structure)
3. [Feature-by-Feature Breakdown](#3-feature-by-feature-breakdown)
4. [Shared Layer Overhaul](#4-shared-layer-overhaul)
5. [State & Data Fetching Conventions](#5-state--data-fetching-conventions)
6. [Component Size Rules](#6-component-size-rules)
7. [Type System Consolidation](#7-type-system-consolidation)
8. [Routing Changes](#8-routing-changes)
9. [i18n Cleanup](#9-i18n-cleanup)
10. [Dead Code to Delete](#10-dead-code-to-delete)
11. [Migration Sequence](#11-migration-sequence)

---

## 0. Progress Update (March 29, 2026)

This section tracks work that is already implemented in code. The sections below this update remain the original reorganization blueprint.

### 0.1 Phase Completion Status

| Phase | Status | Notes |
|---|---|---|
| Phase 1: Foundation | In Progress | Shared/component cleanup and validation consolidation are done; AppContext split and all remaining feature service migrations are still open |
| Phase 2: Editor | In Progress | Route slimming, editor layout decomposition, and core pure-logic tests are done; full `EditorContext` migration is still open |
| Phase 3: Admin DataTable | Not Started | Shared DataTable + customer/order/subscription list rewrites are still open |
| Phase 4: Chat | In Progress | SSE extraction, chat layout split, project sidebar decomposition, and chat service consolidation are done |
| Phase 5: Payments | In Progress | Checkout decomposition and `stripe-payment-fallback.tsx` removal are done; shared `StripePaymentForm` extraction is still open |
| Phase 6: Routing | In Progress | `routes/studio/editor.tsx` converted to thin route file; broader loader rollout is still open |

### 0.2 Completed Work

#### Shared / Foundation

- Removed legacy custom shared component folders and old fallback form error component.
- Consolidated imports to canonical shared component locations (`data-display`, `feedback`, `layout`, etc.).
- Deleted duplicate SEO helper (`shared/services/seo/page-metadata.ts`), keeping the single metadata path.
- Moved validation schemas into `shared/validation/` and removed old validation file usage.

#### Chat

- Extracted transport logic into `features/chat/streaming/sse-client.ts`.
- Split oversized chat layout logic into `useChatLayout` + smaller UI composition.
- Decomposed project sidebar into focused components and hook-driven state handling.
- Consolidated chat HTTP operations in `features/chat/services/chat.service.ts`.

#### Editor

- Reduced route complexity by slimming `routes/studio/editor.tsx` to a thin route wrapper (currently 33 lines).
- Refactored editor layout into focused components:
  - `EditorToolbar.tsx`
  - `EditorWorkspace.tsx`
  - `EditorTimelineSection.tsx`
  - `EditorDialogs.tsx`
- Added dedicated runtime/action hooks:
  - `useEditorAssetMap.ts`
  - `useEditorClipActions.ts`
  - `useEditorTransport.ts`
  - `useEditorLayoutRuntime.ts`
- Reduced `EditorLayout.tsx` from 874 lines to 151 lines.

#### Payments

- Split `order-checkout.tsx` into modular sections and shared local types:
  - `order/QuickAddProducts.tsx`
  - `order/OrderItemsCard.tsx`
  - `order/OrderSummaryCard.tsx`
  - `order/OneTimePurchaseInfoCard.tsx`
  - `order-checkout.types.ts`
- Split `subscription-checkout.tsx` into modular sections and shared local types:
  - `subscription/BillingCycleCard.tsx`
  - `subscription/SelectedPlanCard.tsx`
  - `subscription/SecurityCard.tsx`
  - `subscription/SubscriptionSummaryCard.tsx`
  - `subscription-checkout.types.ts`
- Deleted `features/payments/components/stripe-payment-fallback.tsx`.

#### Admin

- Added `features/admin/types.ts` as shared feature-level type home.
- Added `features/admin/services/niches.service.ts` and `features/admin/hooks/use-niche-mutations.ts`.
- Slimmed `features/admin/hooks/use-niches.ts` to query-focused behavior.
- Added `features/admin/services/admin-music.service.ts` and migrated `use-admin-music.ts` to service-backed calls.

#### Tests

- Added editor pure-logic unit tests:
  - `__tests__/unit/features/editor/split-clip.test.ts`
  - `__tests__/unit/features/editor/snap-targets.test.ts`
  - `__tests__/unit/features/editor/clip-constraints.test.ts`
- Validation status from latest run: type-check, lint, and targeted editor tests pass.

### 0.3 Remaining Work To Reach 100%

- Complete the `AppContext` split into `auth-context.tsx`, `profile-context.tsx`, and `app-provider.tsx` composition.
- Implement shared admin `DataTable` and migrate `customers`, `orders`, and `subscriptions` lists.
- Finish full editor prop-drilling removal via `EditorContext` rollout to timeline/inspector consumers.
- Extract shared `StripePaymentForm` for both checkout flows.
- Add TanStack Router loaders to remaining data-dependent routes and keep route files thin.
- Finish i18n key normalization + dead key cleanup pass.

---

## 1. Current Problems

These are the recurring patterns that cause the most pain. Every recommendation below traces back to one of these root causes.

### 1.1 God Components

The editor, chat, and payment features each have 1–2 files doing everything: data fetching, state management, business logic, layout, and rendering. They are:

| File | Lines | What it does that it shouldn't |
|---|---|---|
| `editor/components/EditorLayout.tsx` | 874 | Orchestrates initialization, autosave, keyboard shortcuts, polling, AND renders the layout |
| `chat/components/ChatLayout.tsx` | 680 | Manages sessions, messages, streaming, AND renders the full chat UI |
| `chat/components/ProjectSidebar.tsx` | 619 | Manages project CRUD state AND renders the sidebar nav |
| `payments/components/stripe-payment-fallback.tsx` | 693 | Initializes Stripe Elements, handles form state, validation, AND renders the form |
| `payments/components/subscription-checkout.tsx` | 529 | Checkout flow logic AND form rendering |

These files are impossible to test in isolation and always produce merge conflicts.

### 1.2 Prop Drilling in the Editor

`EditorLayout` passes `editorState`, `dispatch`, and 10+ handler callbacks down to `Timeline → TimelineClip` and `Inspector → sub-panels`. Adding one field to editor state means touching 5 files. There is no editor context.

### 1.3 Service Layer Is Inconsistent

- `editor` and `payments` have service files (`editor-api.ts`, `payment-service.ts`)
- `reels`, `audio`, and `generation` call `authenticatedFetch` directly inside hooks
- `chat` has `chat.service.ts` but also has API calls inline in some hooks

Hooks should not know about HTTP. Services should.

### 1.4 No DataTable Abstraction

`admin/customers-list.tsx` (559 lines), `admin/orders-list.tsx` (529 lines), and `admin/subscriptions-list.tsx` (350 lines) all implement the same pagination + filter + sort + row-action pattern from scratch. This is ~1,400 lines that should be ~200 lines of shared table + 200 lines each of domain-specific columns.

### 1.5 `AppContext` Is Too Big

`shared/contexts/app-context.tsx` at 502 lines manages Firebase auth state, user profile queries, profile mutations, admin checks, auth methods (signIn, signUp, signInWithGoogle, logout), and computed values. It's doing the job of 3 separate concerns.

### 1.6 Validation Is Scattered

There are 7 validation files in `shared/utils/` (`api-validation.ts`, `auth-validation.ts`, `checkout-validation.ts`, `contact-validation.ts`, `data-validation.ts`, `file-validation.ts`, `search-validation.ts`) plus inline validation inside components and hooks. No single source of truth for any given data shape.

### 1.7 No Tests

Zero test files in the frontend. The most complex subsystem (the editor reducer + autosave) has no coverage. The autosave hash + conflict detection is pure business logic that should be tested.

---

## 2. New Directory Structure

The overall shape stays feature-first. The changes are:
- Every feature gets a consistent internal layout
- `shared/` is flattened and pruned
- `shared/components/ui/` becomes the UI library (Shadcn)
- `shared/components/data-display/` is new (DataTable, EmptyState, etc.)
- Validation moves to `shared/validation/`
- AppContext splits into 3 slices

```
frontend/src/
│
├── features/
│   ├── account/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/          ← NEW: move API calls here
│   │   └── types.ts           ← single types file per feature
│   │
│   ├── admin/
│   │   ├── components/
│   │   │   ├── shared/        ← NEW: AdminDataTable, AdminPageHeader
│   │   │   ├── customers/
│   │   │   ├── orders/
│   │   │   ├── subscriptions/
│   │   │   ├── niches/
│   │   │   └── dashboard/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   ├── audio/
│   │   ├── components/
│   │   ├── contexts/          ← AudioPlaybackContext stays here
│   │   ├── hooks/
│   │   ├── services/          ← NEW: audio.service.ts
│   │   └── types.ts
│   │
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   ├── chat/
│   │   ├── components/
│   │   │   ├── layout/        ← split ChatLayout pieces here
│   │   │   ├── messages/
│   │   │   ├── projects/
│   │   │   └── shared/
│   │   ├── hooks/
│   │   ├── services/          ← consolidate all API calls
│   │   ├── streaming/         ← NEW: extract SSE client here
│   │   └── types.ts
│   │
│   ├── editor/
│   │   ├── components/
│   │   │   ├── timeline/      ← Timeline.tsx + TimelineClip.tsx + Playhead.tsx
│   │   │   ├── inspector/     ← Inspector.tsx + sub-panels
│   │   │   ├── preview/       ← PreviewArea.tsx
│   │   │   ├── media-panel/   ← MediaPanel.tsx
│   │   │   └── shared/        ← common editor UI (track headers, etc.)
│   │   ├── context/           ← NEW: EditorContext.tsx (kills prop drilling)
│   │   ├── hooks/
│   │   ├── model/             ← reducers stay here
│   │   ├── services/          ← editor-api.ts stays here
│   │   ├── utils/
│   │   └── types.ts
│   │
│   ├── generation/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   ├── media/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   ├── payments/
│   │   ├── components/
│   │   │   ├── checkout/      ← split order vs subscription checkout
│   │   │   ├── stripe/        ← NEW: StripeElementsForm (shared by both checkouts)
│   │   │   └── success/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   ├── reels/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/          ← NEW: reels.service.ts
│   │   └── types.ts
│   │
│   ├── subscriptions/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   └── video/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types.ts
│
├── shared/
│   ├── components/
│   │   ├── ui/                ← Shadcn components (unchanged)
│   │   ├── data-display/      ← NEW: DataTable, EmptyState, UsageMeter, StatusBadge
│   │   ├── feedback/          ← NEW: ErrorAlert, FormError, LoadingSpinner
│   │   ├── layout/            ← StudioShell, ErrorBoundary
│   │   ├── navigation/        ← Breadcrumb, StudioTopBar
│   │   └── saas/              ← PricingCard, TierBadge, UpgradePrompt, FeatureGate
│   │
│   ├── contexts/
│   │   ├── auth-context.tsx   ← SPLIT FROM app-context: Firebase auth state only
│   │   ├── profile-context.tsx← SPLIT FROM app-context: User profile + mutations
│   │   └── app-provider.tsx   ← Composes auth + profile + theme providers
│   │
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   ├── use-paginated-data.ts
│   │   └── use-portal-link.ts
│   │
│   ├── lib/
│   │   ├── query-keys.ts      ← unchanged, already good
│   │   ├── query-client.ts
│   │   ├── query-invalidation.ts
│   │   └── i18n.ts
│   │
│   ├── services/
│   │   ├── authenticated-fetch.ts  ← unchanged, already good
│   │   ├── firebase/               ← firebase config, auth, stripe helpers
│   │   └── sentry.ts
│   │
│   ├── validation/            ← CONSOLIDATED from shared/utils/*-validation.ts
│   │   ├── auth.schema.ts
│   │   ├── checkout.schema.ts
│   │   ├── contact.schema.ts
│   │   ├── file.schema.ts
│   │   └── search.schema.ts
│   │
│   ├── constants/             ← unchanged
│   ├── types/                 ← shared domain types (pagination, api responses)
│   └── utils/                 ← only non-validation utils remain here
│
├── routes/                    ← file-based routes, minimal logic only
├── translations/
│   └── en.json
├── main.tsx
└── router.tsx
```

---

## 3. Feature-by-Feature Breakdown

### 3.1 Editor — Highest Priority

The editor is the most complex feature and has the most structural problems. Fix this one first.

#### Problem: No Context → Prop Drilling

`EditorLayout` has this signature today (reconstructed from usage):

```typescript
// What TimelineClip receives today (all drilled from EditorLayout)
interface TimelineClipProps {
  clip: Clip;
  track: Track;
  editorState: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onClipSelect: (id: string) => void;
  onClipMove: (id: string, delta: number) => void;
  onClipResize: (id: string, edge: "start" | "end", delta: number) => void;
  onClipSplit: (id: string, positionMs: number) => void;
  currentTimeMs: number;
  pixelsPerMs: number;
  isSelected: boolean;
  snapTargets: number[];
}
```

**Fix: Create `EditorContext`**

```typescript
// features/editor/context/EditorContext.tsx

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // Derived/computed values so consumers don't recompute
  selectedClip: Clip | null;
  selectedTrack: Track | null;
  currentTimeMs: number;
  pixelsPerMs: number;
  snapTargets: number[];
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used inside EditorProvider");
  return ctx;
}
```

Then `TimelineClip` becomes:

```typescript
function TimelineClip({ clipId }: { clipId: string }) {
  const { state, dispatch, pixelsPerMs, snapTargets } = useEditorContext();
  const clip = state.clips[clipId]; // lookup from context
  // ...
}
```

Every prop drilled from `EditorLayout` disappears from intermediate components.

#### Problem: EditorLayout Is 874 Lines

`EditorLayout` is doing 6 separate jobs. Split it:

```
EditorLayout.tsx              ← BECOMES: just the layout grid (~100 lines)
hooks/useEditorInit.ts        ← NEW: initialization logic (load project, handle first-visit)
hooks/useEditorLifecycle.ts   ← NEW: polling, cleanup, beforeunload handler
hooks/useEditorKeyboard.ts    ← already exists, keep as-is
hooks/useEditorAutosave.ts    ← already exists, keep as-is
hooks/usePlayback.ts          ← already exists, keep as-is
```

`EditorLayout` after:

```typescript
export function EditorLayout() {
  useEditorInit();       // load project on mount
  useEditorLifecycle();  // polling + cleanup
  useEditorKeyboard();   // keyboard shortcuts

  return (
    <EditorProvider>
      <div className="editor-grid">
        <PreviewArea />
        <Inspector />
        <Timeline />
        <MediaPanel />
      </div>
    </EditorProvider>
  );
}
```

#### Problem: Reducer Has 50+ Actions in 3 Files

The reducer split across `editor-reducer.ts`, `editor-reducer-clip-ops.ts`, `editor-reducer-track-ops.ts`, `editor-reducer-session-ops.ts` is fine directionally but the action types still need to be namespaced clearly. The real problem is 50+ action types with complex mutations, which is hard to follow.

**Option A (preferred):** Add `immer` to simplify the mutation logic. Each action becomes a direct state mutation instead of a spread chain. This cuts the reducer files by ~40%.

**Option B:** Keep current approach but add a barrel export in `model/index.ts` so the rest of the editor imports from one place.

#### Tests to Add for Editor

These are pure functions with zero external dependencies. They must be tested:
- `split-clip.ts` — splitting at boundary cases (start, end, mid)
- `clip-constraints.ts` — collision detection
- `snap-targets.ts` — snap calculation
- `editor-reducer-clip-ops.ts` — every action type
- `editor-reducer-track-ops.ts` — every action type
- `useEditorAutosave` — hash change detection, debounce behavior

---

### 3.2 Chat — Second Priority

#### Problem: ChatLayout Is 680 Lines, ProjectSidebar Is 619 Lines

Both mix data management with UI layout.

**Split ChatLayout into:**

```
ChatLayout.tsx                ← layout shell only (~80 lines)
hooks/useChatLayout.ts        ← NEW: manages split-panel state, session switching
components/layout/
  ChatMainArea.tsx             ← message history + input area
  ChatSidebar.tsx              ← thin wrapper around ProjectSidebar
components/projects/
  ProjectSidebar.tsx           ← SHRINKS to ~200 lines (UI only)
hooks/useProjectSidebar.ts    ← NEW: project CRUD state extracted here
```

#### Problem: SSE Streaming Is 456 Lines in a Hook

`use-chat-stream.ts` does too much: SSE connection management, tool call filtering, content accumulation, stale closure handling, React Query integration.

Extract the transport layer:

```typescript
// features/chat/streaming/sse-client.ts
// Pure class, no React, no hooks, no query client
class ChatStreamClient {
  constructor(private url: string, private headers: Record<string, string>) {}

  stream(onChunk: (text: string) => void, onToolCall: (call: ToolCall) => void): () => void {
    // EventSource setup, reconnect logic, cleanup
    // Returns unsubscribe function
  }
}
```

Then `use-chat-stream.ts` becomes the React adapter (~100 lines): creates the client, manages React Query integration, handles cleanup.

#### Problem: API Calls Scattered Between `chat.service.ts` and Hooks

`use-send-message.ts`, `use-chat-sessions.ts`, and `use-projects.ts` each call `authenticatedFetch` directly. Move all HTTP calls to `chat.service.ts` and make hooks just thin wrappers:

```typescript
// features/chat/services/chat.service.ts
export const chatService = {
  getSessions: (projectId: string) => authenticatedFetch(`/api/chat/sessions?projectId=${projectId}`),
  createSession: (projectId: string, title: string) => authenticatedFetch.post(`/api/chat/sessions`, { projectId, title }),
  sendMessage: (sessionId: string, content: string, attachments: Attachment[]) =>
    authenticatedFetch.post(`/api/chat/send`, { sessionId, content, attachments }),
  // ...
};
```

---

### 3.3 Admin — Low Urgency, High ROI

#### Problem: No Shared DataTable

Three list components (customers, orders, subscriptions) each implement their own table with pagination, filters, sorting, and row actions. Build one:

```typescript
// shared/components/data-display/DataTable.tsx

interface DataTableProps<T> {
  columns: ColumnDef<T>[];        // react-table or custom column definition
  data: T[];
  isLoading: boolean;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  filters?: ReactNode;            // slot for filter controls
  emptyMessage?: string;
}
```

Then `customers-list.tsx` becomes ~80 lines of column definitions + filter controls. Same for orders and subscriptions.

Total line reduction: ~1,200 lines → ~400 lines.

#### Problem: Oversized `use-niches.ts` (303 Lines)

This hook has 7+ mutations, 2 queries, and inline types. Split:

```
hooks/use-niches.ts           ← keep, but slim to queries only
hooks/use-niche-mutations.ts  ← all mutations
services/niches.service.ts    ← all HTTP calls
```

---

### 3.4 Payments — Clean Up Stripe Duplication

#### Problem: Stripe Elements Setup Is Duplicated

`order-checkout.tsx` and `subscription-checkout.tsx` both initialize Stripe Elements and render a payment form. The two forms differ only in the data shape they submit.

Extract:

```typescript
// features/payments/components/stripe/StripePaymentForm.tsx

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  submitLabel: string;
  summarySlot?: ReactNode;  // slot for order summary or plan details
}
```

`order-checkout.tsx` and `subscription-checkout.tsx` become ~150 lines each: they fetch their specific data, render their summary, and hand off to `StripePaymentForm`.

`stripe-payment-fallback.tsx` (693 lines) either gets absorbed into `StripePaymentForm` or deleted if it's no longer the primary path.

---

### 3.5 Account — Minor Cleanup

`usage-dashboard.tsx` (483 lines) and `order-detail-modal.tsx` (518 lines) can each shed ~200 lines by:
1. Extracting data fetching into a hook
2. Breaking display into sub-components (`UsageMetricCard`, `OrderLineItem`)

Not urgent. Do this after the editor and chat.

---

## 4. Shared Layer Overhaul

### 4.1 Split `AppContext` (502 Lines → 3 Files)

`app-context.tsx` does three unrelated things. They should be independent:

**`auth-context.tsx`** — Firebase auth state only
```typescript
interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  isAuthLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}
```

**`profile-context.tsx`** — User profile from Postgres
```typescript
interface ProfileContextValue {
  profile: UserProfile | null;
  isAdmin: boolean;
  refreshProfile: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}
```

**`app-provider.tsx`** — Composition root
```typescript
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
```

Any component that currently calls `useApp()` and only uses auth fields should call `useAuth()`. Any component that only uses profile fields calls `useProfile()`. The combined hook `useApp()` can stay as a convenience re-export if needed.

### 4.2 Consolidate Validation Into `shared/validation/`

Delete the 7 scattered `*-validation.ts` files in `shared/utils/`. Move their Zod schemas to `shared/validation/`:

```
shared/validation/
  auth.schema.ts         ← email, password, confirmPassword
  checkout.schema.ts     ← order checkout, subscription checkout
  contact.schema.ts      ← contact form
  file.schema.ts         ← upload constraints (size, type)
  search.schema.ts       ← search/filter params
  profile.schema.ts      ← user profile updates
```

Any validation that was copy-pasted into a component gets replaced with an import from here.

### 4.3 Flatten `shared/components/`

Current structure mixes Shadcn UI primitives with custom composites and SaaS-specific components in inconsistent subdirectory names. Reorganize by purpose:

```
shared/components/
  ui/              ← Shadcn primitives only (Button, Input, Dialog, etc.)
  data-display/    ← DataTable, EmptyState, UsageMeter, StatusBadge, TierBadge
  feedback/        ← ErrorAlert, FormError, LoadingSpinner, SkeletonCard
  layout/          ← StudioShell, ErrorBoundary, AnimatedSection
  navigation/      ← Breadcrumb, StudioTopBar
  saas/            ← PricingCard, UpgradePrompt, FeatureGate, FeatureComparison
  marketing/       ← StructuredData, CookieConsentBanner
```

The old names (`custom-ui/`, `forms/`, `other/`) disappear.

### 4.4 Delete Dead Shared Code

- `shared/providers/auth-provider.tsx` — Superseded by the new `auth-context.tsx`. Delete.
- `shared/utils/mock.ts` — Appears unused. Delete or confirm usage before keeping.
- `shared/components/language-switcher.tsx` — The app only has English. Delete until multi-language is actually implemented.
- `shared/services/page-metadata.ts` and `metadata.ts` — If both exist and overlap, consolidate into one.

---

## 5. State & Data Fetching Conventions

### Rule 1: Hooks Do Not Call `authenticatedFetch` Directly

Every feature must have a `services/[feature].service.ts` that owns all HTTP calls. Hooks call the service; the service calls `authenticatedFetch`.

```typescript
// WRONG — hook calling fetch directly
function useReels(nicheId: string) {
  return useQuery({
    queryKey: queryKeys.api.reels(nicheId),
    queryFn: () => authenticatedFetch(`/api/reels?nicheId=${nicheId}`),
  });
}

// RIGHT — hook uses service
function useReels(nicheId: string) {
  return useQuery({
    queryKey: queryKeys.api.reels(nicheId),
    queryFn: () => reelsService.getByNiche(nicheId),
  });
}
```

### Rule 2: Mutations Always Use `query-invalidation.ts`

All `onSuccess` callbacks in `useMutation` must call the corresponding invalidation function from `shared/lib/query-invalidation.ts`. No inline `queryClient.invalidateQueries` calls in hooks.

### Rule 3: No `queryClient.setQueryData` in Contexts

`AppContext` currently mutates the query cache directly in some places. This is invisible coupling. All cache writes go through mutations with `onSuccess` invalidation or `optimisticUpdate` patterns. The context is not a cache.

### Rule 4: One `types.ts` Per Feature

Feature types live in `features/[feature]/types.ts`. Shared API response shapes (pagination wrappers, error envelopes) live in `shared/types/`. Cross-feature imports of types are not allowed — if two features need the same type, it moves to `shared/types/`.

### Rule 5: Services Are Pure Functions

Services return data or throw. They do not set React state. They do not call hooks. They do not log. They are synchronous logic + async HTTP only.

---

## 6. Component Size Rules

These are hard limits, not suggestions.

| Component type | Max lines |
|---|---|
| Page/Route component | 80 |
| Container component (orchestrates state + children) | 150 |
| UI component (renders data, emits events) | 200 |
| Hook | 150 |
| Service function | 50 per exported function; file total 300 |
| Reducer case file | 400 |
| Context file | 100 |

When a file exceeds these limits, the excess is always extractable: either a custom hook for logic, or a sub-component for rendering. If it seems impossible to stay under the limit, it's a signal the file has multiple responsibilities.

---

## 7. Type System Consolidation

### 7.1 One `types.ts` Per Feature, No Inline Types

Today types are defined:
- In component props interfaces (often unnamed or exported inconsistently)
- In hook files
- In service files
- In dedicated `*.types.ts` files

**Rule:** All exported types for a feature live in `features/[feature]/types.ts`. Props interfaces for components stay in the component file (they are an implementation detail of the component, not a shared type).

### 7.2 Centralize API Response Shapes in `shared/types/`

```typescript
// shared/types/api.ts
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}
```

Every service function returns one of these shapes. No feature invents its own response envelope.

### 7.3 Stripe Types in `payments/types.ts`

Any type that references Stripe (`PaymentIntent`, `StripeError`, `CheckoutSession`) lives only in `features/payments/types.ts`. Nothing outside payments imports Stripe types.

---

## 8. Routing Changes

### 8.1 Route Files Are Route Files, Not Components

Every route file in `routes/` should do one thing: compose and return a component. All logic lives in that component or its hooks. The route file is not the place for data fetching, guard logic, or conditional rendering beyond the `AuthGuard`.

**Today (too much in route file):**
```typescript
// routes/studio/editor.tsx — today, mixed concerns
export function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useQuery(...);
  // 50 more lines of logic
  return <EditorLayout project={project} />;
}
```

**After:**
```typescript
// routes/studio/editor.tsx — route file
export function Editor() {
  return (
    <AuthGuard>
      <EditorLayout />
    </AuthGuard>
  );
}
```

The `EditorLayout` component owns all initialization logic. The route owns nothing except the guard and the component selection.

### 8.2 Loader Pattern for Data-Dependent Routes

For pages that need data before rendering (admin pages, the editor), use TanStack Router's `loader` function to preload queries. This eliminates the waterfall of "mount → fetch → render" and removes loading state management from components.

```typescript
// routes/admin/customers.tsx
export const Route = createFileRoute("/admin/customers")({
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: queryKeys.api.admin.customers(),
      queryFn: () => adminService.getCustomers(),
    }),
  component: CustomersPage,
});
```

---

## 9. i18n Cleanup

### 9.1 Current State

`en.json` has 1,535 keys with inconsistent naming conventions:
- Some use `common_page_not_found` (underscore, module prefix)
- Some use `editor.timeline.clip.label` (dot-separated hierarchy) — check actual file
- Some are just raw English phrases used as keys

### 9.2 Rules

1. **All keys use dot notation with feature prefix:** `auth.signIn.title`, `editor.timeline.addClip`, `admin.customers.title`
2. **No raw English as key names.** Keys describe the UI location, not the content.
3. **Feature-specific keys live in feature namespaces.** Common UI text (Cancel, Save, Delete, Loading...) lives in `common.*`.
4. **Dead keys get deleted.** Run `i18next-scanner` or similar to detect keys in `en.json` that no component references, and remove them.

### 9.3 `language-switcher.tsx`

The language switcher component exists but there is only one language. Delete this component until multi-language support is actually built. It adds confusion and dead code.

---

## 10. Dead Code to Delete

These are files or patterns that serve no current purpose:

| File | Reason to delete |
|---|---|
| `shared/providers/auth-provider.tsx` | Superseded by AppContext; nothing imports it |
| `shared/utils/mock.ts` | Appears unused; verify with grep before deleting |
| `shared/components/language-switcher.tsx` | Only English exists; no consumer |
| `features/studio/StudioTopBar.tsx` | Verify if this is used or replaced by `shared/navigation/` |
| `features/generation/` (single hook) | If `use-generation.ts` only wraps `use-chat-sessions.ts`, it should be merged |
| Any `console.log` in non-debug files | Replace with `debugLog` or delete |
| Comments describing code that no longer exists | Delete |
| Any prop defined in an interface but never passed by callers | Delete the prop |

Before deleting, grep for usage. "Appears unused" is not the same as "is unused."

---

## 11. Migration Sequence

Do not attempt this all at once. Work in this order — each step delivers standalone value and doesn't depend on the next.

### Phase 1: Foundation (Do First)

These changes make every subsequent step easier. No UI changes.

1. **Split `AppContext`** into `auth-context.tsx` and `profile-context.tsx`. All existing consumers of `useApp()` keep working through a re-export shim, then update them incrementally.
2. **Consolidate validation** — move the 7 `*-validation.ts` files into `shared/validation/`. Update imports.
3. **Add service files to features that lack them** — `reels`, `audio`, `generation`. Move `authenticatedFetch` calls from hooks to services. Hooks get thinner.
4. **Flatten `shared/components/`** — rename directories, update all imports.

### Phase 2: Editor (Highest Complexity Reduction)

5. **Create `EditorContext`** — define context, create `EditorProvider`, wrap `EditorLayout`. No behavior changes yet.
6. **Thread context into `TimelineClip` and `Inspector`** — remove drilled props one level at a time, verifying each step.
7. **Extract `useEditorInit` and `useEditorLifecycle`** from `EditorLayout` — reduce file to layout shell.
8. **Add tests for the reducer** — pure functions, no mocking needed.

### Phase 3: Admin DataTable

9. **Build `DataTable` component** in `shared/components/data-display/`.
10. **Rewrite `customers-list.tsx`** using DataTable. Delete old implementation.
11. **Rewrite `orders-list.tsx`** and `subscriptions-list.tsx` the same way.

### Phase 4: Chat

12. **Extract `sse-client.ts`** from `use-chat-stream.ts`.
13. **Consolidate all chat API calls** into `chat.service.ts`.
14. **Split `ChatLayout`** using `useChatLayout` hook + sub-components.

### Phase 5: Payments

15. **Extract `StripePaymentForm`** shared component.
16. **Reduce `order-checkout.tsx`** and `subscription-checkout.tsx` to use it.
17. **Delete `stripe-payment-fallback.tsx`** if no longer primary path.

### Phase 6: Routing

18. **Add TanStack Router loaders** to data-dependent routes.
19. **Strip logic from route files** into components.

---

## Summary: What This Changes

After this reorganization:

- **No file exceeds ~400 lines** (reducers) or ~200 lines (components/hooks)
- **Editor has a context** — adding a field to editor state touches 1 file
- **Every feature has a service** — hooks never call `authenticatedFetch`
- **One `types.ts` per feature** — types are findable
- **One `shared/validation/`** — form schemas are reusable
- **Three admin list components** shrink to column definitions using a shared DataTable
- **`AppContext` is gone** — replaced by two focused contexts
- **Dead code is deleted** — no `language-switcher`, no orphaned provider, no unused mock

The codebase goes from ~57,000 lines of which ~10,000 are in oversized files nobody wants to touch, to a structure where every file has one job and the right size.
