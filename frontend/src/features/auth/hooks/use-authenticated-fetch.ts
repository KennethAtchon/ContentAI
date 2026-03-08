import { useCallback } from "react";
import { useApp } from "@/shared/contexts/app-context";
import {
  authenticatedFetch as authFetch,
  authenticatedFetchJson as authFetchJson,
} from "@/shared/services/api/authenticated-fetch";
import { addTimezoneHeader } from "@/shared/utils/api/add-timezone-header";

/**
 * Hook that provides authenticated fetch functions for React components
 * Uses the centralized authenticated-fetch service with built-in retry logic
 * Gets user from app context (useApp hook)
 */
export function useAuthenticatedFetch() {
  const { user } = useApp();

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      return authFetch(url, addTimezoneHeader(options));
    },
    [user]
  );

  const authenticatedFetchJson = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      return authFetchJson<T>(url, addTimezoneHeader(options));
    },
    [user]
  );

  return {
    authenticatedFetch,
    authenticatedFetchJson,
    isAuthenticated: !!user,
  };
}
