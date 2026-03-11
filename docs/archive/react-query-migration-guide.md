# React Query (TanStack Query) Migration Guide

**Status:** Planning / Reference  
**Scope:** Migrate all client-side data fetching from SWR to TanStack Query v5.  
**Last Updated:** February 2026

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [SWR vs React Query – Concept Mapping](#2-swr-vs-react-query--concept-mapping)
3. [Production-Grade React Query Setup](#3-production-grade-react-query-setup)
4. [Shared Infrastructure](#4-shared-infrastructure)
5. [File-by-File Migration Checklist](#5-file-by-file-migration-checklist)
6. [Cache Invalidation & Mutations](#6-cache-invalidation--mutations)
7. [Pagination & Special Hooks](#7-pagination--special-hooks)
8. [Testing & DevTools](#8-testing--devtools)
9. [Docs & Conventions Updates](#9-docs--conventions-updates)
10. [Rollback & Coexistence](#10-rollback--coexistence)

---

## 1. Overview & Goals

### Why Migrate

- **Stronger typing & DevTools:** Query keys as arrays, built-in DevTools, clearer cache model.
- **Mutations & invalidation:** First-class `useMutation` + `queryClient.invalidateQueries()` with predicate/filters.
- **Production features:** Retry policies, persistence (optional), request cancellation, dependent queries.
- **Ecosystem:** TanStack Query is widely adopted; patterns and examples are easy to find.

### Goals

- Replace **all** SWR usage with React Query without changing API contracts or auth/CSRF behavior.
- Keep **one** authenticated GET fetcher pattern (like current `useSWRFetcher` + `authenticatedFetchJson`).
- Preserve behavior: revalidate on focus/reconnect where used, cache clearing on logout, per-query options (e.g. portal link 5-min cache, profile 5-min refresh).
- Document production-grade defaults: retries, stale time, gc, logging, error handling.

### Current SWR Usage Summary

| Area | Files | Pattern |
|------|--------|---------|
| **Global config** | `shared/providers/swr-provider.tsx` | `SWRConfig` (revalidate, dedupe, retry, onError/onSuccess) |
| **Fetcher** | `shared/hooks/use-swr-fetcher.ts` | `useSWRFetcher()` → `authenticatedFetchJson` + timezone |
| **App context** | `shared/contexts/app-context.tsx` | Profile + logout cache clear via `mutate(key => …)` |
| **Pagination** | `shared/hooks/use-paginated-data.ts` | `useSWR(swrKey, paginatedFetcher)` + local page state |
| **Portal link** | `shared/hooks/use-portal-link.ts` | `useSWR` with long dedupe, no revalidate on focus |
| **Generator** | `features/generator/hooks/use-generator.ts` | Usage stats + post-generation invalidation |
| **Subscription** | `features/subscriptions/hooks/use-subscription.ts` | `mutate(predicate)` when role changes |
| **Account** | `usage-dashboard.tsx`, `subscription-management.tsx` | Usage stats, export invalidation |
| **Admin** | dashboard, orders, customers, subscriptions, contact messages | Lists, analytics, forms |
| **Checkout / Pricing** | checkout-interactive, subscription-checkout, PricingCard | Trial eligibility, current subscription |

---

## 2. SWR vs React Query – Concept Mapping

| SWR | React Query v5 |
|-----|-----------------|
| `useSWR(key, fetcher, options)` | `useQuery({ queryKey, queryFn, ...options })` |
| Key: string or `null` (skip) | `queryKey: [string]` or `enabled: false` |
| `mutate(key)` / `mutate(predicate)` | `queryClient.invalidateQueries({ queryKey })` / `predicate` |
| `mutate(key, data, { revalidate: false })` | `queryClient.setQueryData(queryKey, data)` |
| `revalidateOnFocus` | `refetchOnWindowFocus` |
| `revalidateOnReconnect` | `refetchOnReconnect` |
| `dedupingInterval` | `staleTime` (no refetch if still fresh) + single in-flight request per key |
| `errorRetryCount` / `errorRetryInterval` | `retry` / `retryDelay` |
| `refreshInterval` | `refetchInterval` |
| `revalidateIfStale` | Default: refetch when stale on mount; control with `staleTime` |
| Global `onError` / `onSuccess` | `QueryClient` default options + `queryCache` / `mutationCache` subscribers |

**Skip fetch:** SWR uses `key === null`. In React Query use `enabled: !!user` (or similar) and include `user` in `queryKey` so cache is keyed by user.

---

## 3. Production-Grade React Query Setup

### 3.1 Install

```bash
bun add @tanstack/react-query
# Optional: DevTools (recommended in dev)
bun add -D @tanstack/react-query-devtools
```

### 3.2 QueryClient – Default Options

Create a single `QueryClient` with production-friendly defaults and logging aligned with your existing `debugLog` and API patterns.

**Suggested location:** `project/shared/lib/query-client.ts` (or `shared/config/query-client.ts`)

```typescript
"use client";

import { QueryClient, QueryCache } from "@tanstack/react-query";
import { debugLog } from "@/shared/utils/debug";

export const QUERY_STALE = {
  default: 0,           // Consider data stale immediately (refetch on focus/mount as today)
  medium: 60 * 1000,    // 1 minute
  long: 5 * 60 * 1000,  // 5 minutes (e.g. profile, portal link)
} as const;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE.default,
        gcTime: 10 * 60 * 1000,           // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnMount: true,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        debugLog.error(
          `Query error [${query.queryKey.join(",")}]`,
          { service: "react-query", operation: "query" },
          error
        );
      },
      onSuccess: (data, query) => {
        debugLog.debug(
          `Query success [${query.queryKey.join(",")}]`,
          { service: "react-query", operation: "query" },
          { key: query.queryKey, hasData: !!data }
        );
      },
    }),
  });
}

export type QueryClientInstance = ReturnType<typeof makeQueryClient>;
```

- Use **query key arrays** consistently, e.g. `["api", "profile"]`, `["api", "generator", "usage"]`, so you can invalidate by prefix.
- For Next.js App Router, create the client in a **client component** (or via `useState(() => makeQueryClient())`) so it’s not shared across requests if you ever do SSR with React Query.

### 3.3 Provider – Replace SWRProvider

**Location:** `project/shared/providers/query-provider.tsx`

- Use `QueryClientProvider` from `@tanstack/react-query`.
- Create client with `useState(() => makeQueryClient())` so one client per client tree.
- Optionally render `ReactQueryDevtools` when `process.env.NODE_ENV === "development"`.

```tsx
"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/shared/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
```

In `app/layout.tsx`, replace `SWRProvider` with `QueryProvider` (same nesting as today, e.g. inside `AppProvider`).

### 3.4 Clearing Cache on Logout

Today you clear all `/api/` SWR cache on logout and when auth state becomes null. With React Query:

- In `AppProvider`, when user logs out or `onAuthStateChanged` fires with `null`, call:

```typescript
queryClient.removeQueries({ predicate: (query) => {
  const key = query.queryKey;
  return Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith("api");
}});
```

So you need **access to `queryClient`** in `AppProvider`:

- Either pass `queryClient` from a parent that renders `QueryClientProvider` (and keep `AppProvider` inside it), or
- Use `useQueryClient()` inside `AppProvider` and ensure `AppProvider` is rendered **inside** `QueryClientProvider` in the layout.

Recommended: **Layout order** `QueryClientProvider` → `AppProvider` → rest. Then inside `AppProvider` call `useQueryClient()` and run the `removeQueries` predicate on logout and when auth becomes null.

---

## 4. Shared Infrastructure

### 4.1 Authenticated Query Fetcher (replacement for useSWRFetcher)

Keep using `authenticatedFetchJson` and timezone header so auth/CSRF behavior is unchanged.

**Location:** `project/shared/hooks/use-query-fetcher.ts` (or keep a single fetcher used by both hooks)

```typescript
import { useCallback } from "react";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { TimeService } from "@/shared/services/timezone/TimeService";

export type QueryFetcher<T = unknown> = (url: string) => Promise<T>;

export function useQueryFetcher<T = unknown>(): QueryFetcher<T> {
  return useCallback(async (url: string): Promise<T> => {
    return authenticatedFetchJson<T>(url, {
      headers: {
        "x-timezone": TimeService.getBrowserTimezone(),
      },
    });
  }, []);
}
```

Use this as `queryFn`:

```typescript
const fetcher = useQueryFetcher<ProfileResponse>();
useQuery({
  queryKey: ["api", "customer", "profile"],
  queryFn: () => fetcher("/api/customer/profile"),
  enabled: !!user && !authLoading,
});
```

### 4.2 Query Key Factory (optional but recommended)

Centralize query keys so invalidation and refetch are consistent.

**Location:** `project/shared/lib/query-keys.ts`

```typescript
export const queryKeys = {
  api: {
    profile: () => ["api", "customer", "profile"] as const,
    generatorUsage: () => ["api", "generator", "usage"] as const,
    generatorHistory: (params?: { page?: number; limit?: number }) =>
      ["api", "generator", "history", params] as const,
    trialEligibility: () => ["api", "subscriptions", "trial-eligibility"] as const,
    currentSubscription: () => ["api", "subscriptions", "current"] as const,
    portalLink: () => ["api", "subscriptions", "portal-link"] as const,
    usageStats: () => ["api", "account", "usage"] as const,
    admin: {
      orders: (page?: number, limit?: number) => ["api", "admin", "orders", { page, limit }] as const,
      users: () => ["api", "admin", "users"] as const,
      customers: (page?: number, limit?: number) => ["api", "admin", "customers", { page, limit }] as const,
      dashboard: () => ["api", "admin", "dashboard"] as const,
      subscriptions: () => ["api", "admin", "subscriptions"] as const,
      contactMessages: (page?: number, limit?: number) => ["api", "shared", "contact-messages", { page, limit }] as const,
    },
  },
};
```

Then invalidation becomes:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.api.generatorUsage() });
queryClient.invalidateQueries({ predicate: (q) => queryKeyMatches(q.queryKey, ["api", "generator", "history"]) });
```

---

## 5. File-by-File Migration Checklist

Use this as a checklist; implement in an order that avoids breaking the app (e.g. provider and app-context first, then shared hooks, then features).

### 5.1 Global

| Task | File | Action |
|------|------|--------|
| ✅ | `shared/lib/query-client.ts` | Create (or `shared/config/query-client.ts`) |
| ✅ | `shared/providers/query-provider.tsx` | Create; add DevTools in dev |
| ✅ | `app/layout.tsx` | Replace `SWRProvider` with `QueryProvider`; ensure `QueryProvider` wraps `AppProvider` or vice versa so logout can call `useQueryClient()` |
| ✅ | `shared/contexts/app-context.tsx` | Replace SWR profile fetch with `useQuery`, use `useQueryClient()` for logout/onAuthStateChanged clear |

### 5.2 Shared Hooks

| Task | File | Action |
|------|------|--------|
| ✅ | `shared/hooks/use-query-fetcher.ts` | Create (replacement for useSWRFetcher) |
| ✅ | `shared/hooks/use-paginated-data.ts` | Rewrite to use `useQuery` + page in key or state; refetch on page change; expose `refetch` and reset via `queryClient.removeQueries` or refetch |
| ✅ | `shared/hooks/use-portal-link.ts` | Replace `useSWR` with `useQuery` (long `staleTime`/`gcTime`, no refetch on focus); POST in `queryFn` |

### 5.3 App Context

- **Profile:** `queryKey: queryKeys.api.profile()`, `queryFn: () => fetcher("/api/customer/profile")`, `enabled: !!user && !authLoading`, `staleTime: 5 * 60 * 1000`, `refetchInterval: 5 * 60 * 1000`, no refetch on focus if you want to match current 5-min behavior.
- **Logout / auth null:** Call `queryClient.removeQueries({ predicate })` for keys starting with `api` (or use your key factory).

### 5.4 Features – Account

| File | Current | Migration |
|------|--------|-----------|
| `features/account/components/usage-dashboard.tsx` | useSWR usage + history, mutate after export | `useQuery` for usage + history; after export call `queryClient.invalidateQueries` for usage and history keys |
| `features/account/components/subscription-management.tsx` | useSWR usage stats | `useQuery` with `queryKeys.api.usageStats()` |

### 5.5 Features – Generator

| File | Current | Migration |
|------|--------|-----------|
| `features/generator/hooks/use-generator.ts` | useSWR usage; mutate + mutateUsageStats after calculate | `useQuery` for usage; after generation `queryClient.invalidateQueries(usage)` and history; optionally `refetch()` from the usage query |

### 5.6 Features – Subscriptions

| File | Current | Migration |
|------|--------|-----------|
| `features/subscriptions/hooks/use-subscription.ts` | mutate(predicate) when role changes | On role change call `queryClient.invalidateQueries({ predicate })` for keys containing `/api/admin/subscriptions`, `/api/generator/usage`, `/api/subscriptions` (or use query key helpers). |

### 5.7 Features – Admin

| File | Current | Migration |
|------|--------|-----------|
| `features/admin/components/dashboard/dashboard-view.tsx` | Multiple useSWR (customers, conversion, revenue, subscriptions) | One `useQuery` per metric with `queryKeys.api.admin.dashboard()` or per-metric keys |
| `features/admin/components/orders/order-form.tsx` | useSWR users + mutate orders/users after submit | `useQuery` for users; on success `invalidateQueries` for orders and users |
| `features/admin/components/customers/customers-list.tsx` | useSWR list | `useQuery` or `usePaginatedData` (React Query version) |
| `features/admin/components/subscriptions/subscriptions-view.tsx` | useSWR subscription stats | `useQuery` |
| `features/admin/components/subscriptions/subscription-analytics.tsx` | useSWR analytics | `useQuery` |
| `app/admin/contactmessages/contact-messages-interactive.tsx` | useSWR paginated | Use shared `usePaginatedData` (React Query) or local `useQuery` with page in key |

### 5.8 Checkout & Pricing

| File | Current | Migration |
|------|--------|-----------|
| `app/(customer)/(main)/checkout/checkout-interactive.tsx` | useSWR current subscription + trial eligibility | Two `useQuery` calls with appropriate keys and `enabled` |
| `features/payments/components/checkout/subscription-checkout.tsx` | useSWR trial eligibility | `useQuery` trial eligibility |
| `shared/components/saas/PricingCard.tsx` | useSWR trial eligibility | `useQuery` trial eligibility |

### 5.9 Remove SWR

- Delete or deprecate `shared/providers/swr-provider.tsx`.
- Delete or deprecate `shared/hooks/use-swr-fetcher.ts`.
- Remove `swr` from `package.json` after all usages are migrated.

---

## 6. Cache Invalidation & Mutations

### 6.1 Invalidation Patterns

- **Single query:** `queryClient.invalidateQueries({ queryKey: queryKeys.api.generatorUsage() })`.
- **By prefix:** `queryClient.invalidateQueries({ queryKey: ["api", "generator"] })` (invalidates all queries whose key starts with that).
- **By predicate:**  
  `queryClient.removeQueries({ predicate: (q) => keyMatches(q.queryKey, ["api"]) })` for logout.  
  For “all generator and subscription related”: predicate that checks `queryKey` array for substrings or key segments.

### 6.2 After Mutations (e.g. create order, run generation, export)

- Use `queryClient.invalidateQueries(...)` so the next read refetches.
- Optionally use `queryClient.refetchQueries(...)` if you want an immediate refetch in the same tick.

### 6.3 Optimistic Updates (optional)

Where you currently don’t use optimistic UI, you can leave as-is. If you add it later, use `useMutation` with `onMutate` / `onError` / `onSettled` and `queryClient.setQueryData` / `invalidateQueries`.

---

## 7. Pagination & Special Hooks

### 7.1 usePaginatedData (React Query version)

- Keep the same public API: `urlBuilder(page, limit)`, `options` (initialPage, initialLimit, transformResponse, etc.).
- Internally: `useQuery({ queryKey: ["api", "paginated", urlBuilder(currentPage, currentLimit)], queryFn: () => paginatedFetcher(url), enabled })`.
- When `currentPage` or `currentLimit` change, the key changes and React Query fetches the new page.
- `refetch`: from `useQuery`’s `refetch`.
- `reset`: set page back to initial and optionally `queryClient.removeQueries({ queryKey: ["api", "paginated", ...] })` or just set state and let the next read refetch.

### 7.2 usePortalLink

- POST in `queryFn`; key e.g. `queryKeys.api.portalLink()`.
- `staleTime: 5 * 60 * 1000`, `gcTime: 5 * 60 * 1000`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `enabled: !!user`.

---

## 8. Testing & DevTools

- **Unit tests:** Create a new `QueryClient` per test (or use `QueryClientProvider` with a fresh client) so cache doesn’t leak between tests.
- **Mocking:** Mock `@tanstack/react-query`’s `useQuery` / `useQueryClient` or the underlying `authenticatedFetchJson` as you do today for SWR.
- **DevTools:** Use `@tanstack/react-query-devtools` in development to inspect cache, refetch, and invalidate during the migration.

---

## 9. Docs & Conventions Updates

After migration:

- **CLAUDE.md:** Replace “useSWR with useSWRFetcher” with “use useQuery with useQueryFetcher” and point to this guide and `api.md`.
- **docs/AI_Orchestrator/architecture/core/api.md:** In “Client-Side Fetch Utilities”, add a subsection “React Query (TanStack Query)” describing:
  - GET/caching: `useQuery` + `useQueryFetcher` (or equivalent).
  - Mutations: `useMutation` + `authenticatedFetch`/`authenticatedFetchJson`, then `queryClient.invalidateQueries`.
  - Query keys: use shared `queryKeys` and clear on logout.
- **AI_Orchestrator index:** Link to this migration guide under Architecture Considerations.

---

## 10. Rollback & Coexistence

- **Rollback:** Keep SWR in `package.json` until migration is verified in production. Revert layout to `SWRProvider`, restore `useSWRFetcher`/`useSWR` in the checklist files, then remove React Query if needed.
- **Coexistence:** Not recommended long-term; both libraries will cache independently. If you must run both briefly, run them in parallel and migrate one component at a time, then remove SWR.

---

## Quick Reference – Before/After Snippets

**Before (SWR):**

```tsx
const fetcher = useSWRFetcher<UsageStats>();
const { data, error, isLoading, mutate } = useSWR(
  user ? "/api/generator/usage" : null,
  fetcher,
  { revalidateOnFocus: false }
);
// later: mutate("/api/generator/usage"); mutate((k) => ...);
```

**After (React Query):**

```tsx
const fetcher = useQueryFetcher<UsageStats>();
const { data, error, isLoading, refetch } = useQuery({
  queryKey: queryKeys.api.generatorUsage(),
  queryFn: () => fetcher("/api/generator/usage"),
  enabled: !!user,
  refetchOnWindowFocus: false,
});
// later: queryClient.invalidateQueries({ queryKey: queryKeys.api.generatorUsage() });
```

---

*End of migration guide. Implement in small steps and run tests and manual smoke after each batch.*
