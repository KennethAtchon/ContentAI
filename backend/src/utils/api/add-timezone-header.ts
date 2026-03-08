import { TimeService } from "@/services/timezone/TimeService";

/**
 * Utility function to add timezone header to request options
 * Used by both AppProvider and useAuthenticatedFetch hook to avoid duplication
 */
export function addTimezoneHeader(options: RequestInit = {}): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      "x-timezone": TimeService.getBrowserTimezone(),
    } as Record<string, string>,
  };
}
