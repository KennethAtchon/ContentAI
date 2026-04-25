/**
 * React Query client factory with production-grade defaults and logging.
 * Used by QueryProvider; create one client per client tree (e.g. via useState).
 */

"use client";

import { QueryClient, QueryCache } from "@tanstack/react-query";
import { debugLog } from "@/shared/debug";

export const QUERY_STALE = {
  /** Consider data stale immediately (refetch on focus/mount) */
  default: 0,
  /** 1 minute */
  medium: 60 * 1000,
  /** 5 minutes (e.g. profile, portal link) */
  long: 5 * 60 * 1000,
} as const;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE.default,
        gcTime: 10 * 60 * 1000,
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
