import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient for the SPA — shared by QueryClientProvider and TanStack Router
 * loaders (see `shared/lib/route-data-prefetch.ts`).
 */
export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});
