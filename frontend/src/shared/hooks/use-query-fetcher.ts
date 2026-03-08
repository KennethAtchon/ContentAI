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
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { TimeService } from "@/shared/services/timezone/TimeService";

export type QueryFetcher<T = unknown> = (url: string) => Promise<T>;

export function useQueryFetcher<T = unknown>(): QueryFetcher<T> {
  return useCallback(async (_url: string): Promise<T> => {
    return authenticatedFetchJson<T>(_url, {
      headers: {
        "x-timezone": TimeService.getBrowserTimezone(),
      },
    });
  }, []);
}
