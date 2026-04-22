/**
 * Query Fetcher Hook (React Query replacement for useSWRFetcher)
 *
 * Provides a fetcher function for useQuery that integrates with:
 * - authenticatedFetchJson (handles auth, CSRF, timezone headers)
 * - TimeService for timezone headers
 *
 * @example
 * const fetcher = useQueryFetcher<ProfileResponse>();
 * useQuery({
 *   queryKey: queryKeys.api.profile(),
 *   queryFn: () => fetcher("/api/customer/profile"),
 *   enabled: !!user,
 * });
 */

import { useCallback } from "react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { TimeService } from "@/shared/services/timezone/TimeService";

export type QueryFetcher<T = unknown> = (
  url: string,
  timeout?: number
) => Promise<T>;

export function useQueryFetcher<T = unknown>(): QueryFetcher<T> {
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useCallback(
    async (_url: string, timeout?: number): Promise<T> => {
      return authenticatedFetchJson<T>(
        _url,
        {
          headers: {
            "x-timezone": TimeService.getBrowserTimezone(),
          },
        },
        timeout
      );
    },
    [authenticatedFetchJson]
  );
}
