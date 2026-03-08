# ADR-007: Use React Query (TanStack Query) for Data Fetching

**Date:** Jan 2026  
**Status:** Accepted  
**Supersedes:** SWR (used prior to Jan 2026)

## Context

Client-side data fetching needed caching, background refetch, loading/error states, and cache invalidation. The project migrated from SWR when React Query's features and ecosystem maturity became clearly superior.

## Decision

Use **TanStack Query v5** (`@tanstack/react-query`) for all client-side data fetching via the `useQueryFetcher` hook pattern.

All query keys are centralised in `shared/lib/query-keys.ts`.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| SWR | Fewer features; worse cache invalidation; weaker TypeScript support |
| Redux Toolkit Query | Too much boilerplate; RTK not used elsewhere in the project |
| Apollo Client | GraphQL only; not using GraphQL |
| Manual fetch + useState | No caching; high boilerplate; error-prone |

## Consequences

- ✅ Automatic background refetch and stale-while-revalidate
- ✅ Optimistic updates and cache invalidation
- ✅ Strong TypeScript generics
- ✅ DevTools available in development
- ✅ Centralised query key management prevents cache key collisions
- ⚠️ Learning curve for developers new to React Query patterns
- ⚠️ `QueryProvider` must wrap the component tree (see `shared/providers/query-provider.tsx`)
