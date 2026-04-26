import { useCallback } from "react";
import { useAuth } from "@/app/state/auth-context";
import {
  authenticatedFetch as authFetch,
  authenticatedFetchJson as authFetchJson,
} from "@/shared/api/authenticated-fetch";
import { addTimezoneHeader } from "@/shared/api/add-timezone-header";

/**
 * Hook that provides authenticated fetch functions for React components
 * Uses the centralized authenticated-fetch service with built-in retry logic
 * Gets user from the auth store facade.
 */
export function useAuthenticatedFetch() {
  const { user } = useAuth();

  const authenticatedFetch = useCallback(
    async (
      url: string,
      options: RequestInit = {},
      timeout?: number
    ): Promise<Response> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      return authFetch(url, addTimezoneHeader(options), timeout);
    },
    [user]
  );

  const authenticatedFetchJson = useCallback(
    async <T = any>(
      url: string,
      options: RequestInit = {},
      timeout?: number
    ): Promise<T> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      return authFetchJson<T>(url, addTimezoneHeader(options), timeout);
    },
    [user]
  );

  return {
    authenticatedFetch,
    authenticatedFetchJson,
    isAuthenticated: !!user,
  };
}
