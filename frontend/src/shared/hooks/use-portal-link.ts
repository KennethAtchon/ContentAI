/**
 * Portal Link Hook
 *
 * Fetches and caches Stripe Customer Portal link using React Query.
 * Automatically handles caching, deduplication, and optional revalidation.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import { queryKeys } from "@/shared/lib/query-keys";
import { QUERY_STALE } from "@/shared/lib/query-client";

interface PortalLinkResponse {
  url: string;
}

/**
 * Hook to get Stripe Customer Portal link with automatic caching
 *
 * @returns Portal URL, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { portalUrl, isLoading, error } = usePortalLink();
 *
 * if (portalUrl) {
 *   window.location.href = portalUrl;
 * }
 * ```
 */
export function usePortalLink() {
  const { user } = useApp();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  const queryFn = async (): Promise<string> => {
    const response = await authenticatedFetchJson<PortalLinkResponse>(
      "/api/subscriptions/portal-link",
      {
        method: "POST",
      }
    );
    return response.url;
  };

  const {
    data: portalUrl,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.api.portalLink(),
    queryFn,
    enabled: !!user,
    staleTime: QUERY_STALE.long,
    gcTime: QUERY_STALE.long,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    portalUrl: portalUrl ?? null,
    isLoading,
    error,
    refresh: refetch,
  };
}
