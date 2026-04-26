/**
 * Portal Link Hook
 *
 * Fetches and caches Stripe Customer Portal link using React Query.
 * Automatically handles caching, deduplication, and optional revalidation.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { useAuth } from "@/app/state/auth-context";
import { queryKeys } from "@/app/query/query-keys";

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
  const { user } = useAuth();
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
    staleTime: 0,
    gcTime: 0,
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
