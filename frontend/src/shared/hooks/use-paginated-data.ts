/**
 * usePaginatedData Hook
 *
 * Hook for managing paginated data fetching with loading, error, and pagination states.
 * Powered by React Query for automatic caching, deduplication, and background revalidation.
 *
 * @example
 * // Simple usage with URL builder
 * const { data, loading, error, pagination, fetchPage } = usePaginatedData(
 *   (page, limit) => `/api/items?page=${page}&limit=${limit}`,
 *   { page: 1, limit: 20 }
 * );
 *
 * @example
 * // With response transformer for different API formats
 * const { data, loading, error, pagination, fetchPage } = usePaginatedData(
 *   (page, limit) => `/api/orders?page=${page}&limit=${limit}`,
 *   {
 *     page: 1,
 *     limit: 20,
 *     transformResponse: (response) => ({
 *       data: response.orders || [],
 *       pagination: response.pagination,
 *     }),
 *   }
 * );
 */
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/shared/contexts/app-context";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/utils/debug";

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface UsePaginatedDataOptions {
  /**
   * Initial page number
   * @default 1
   */
  initialPage?: number;
  /**
   * Items per page
   * @default 20
   */
  initialLimit?: number;
  /**
   * Whether to fetch data immediately on mount
   * @default true
   */
  immediate?: boolean;
  /**
   * Custom error message formatter
   */
  formatError?: (_error: unknown) => string;
  /**
   * Service name for logging
   */
  serviceName?: string;
  /**
   * Whether to log fetch operations
   * @default true
   */
  enableLogging?: boolean;
  /**
   * Transform the API response to match PaginatedResponse format
   * Useful when API returns different structure (e.g., { orders: [], pagination: {} })
   */
  transformResponse?: (_response: unknown) => PaginatedResponse<unknown>;
}

const DEFAULT_OPTIONS: Required<
  Omit<UsePaginatedDataOptions, "formatError" | "transformResponse">
> = {
  initialPage: 1,
  initialLimit: 20,
  immediate: true,
  serviceName: "use-paginated-data",
  enableLogging: true,
};

export interface PaginatedState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
}

/**
 * Hook for managing paginated data fetching with React Query
 *
 * @param urlBuilder - Function that builds the API URL from page and limit
 * @param options - Configuration options
 */
export function usePaginatedData<T>(
  urlBuilder: (page: number, limit: number) => string,
  options: UsePaginatedDataOptions = {}
): PaginatedState<T> & {
  fetchPage: (page: number) => Promise<void>;
  fetchNext: () => Promise<void>;
  fetchPrevious: () => Promise<void>;
  refetch: () => Promise<void>;
  reset: () => void;
} {
  const opts = {
    ...DEFAULT_OPTIONS,
    formatError: (error: unknown) =>
      error instanceof Error ? error.message : "Unknown error occurred",
    ...options,
  };

  const { user, authLoading } = useApp();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  const [currentPage, setCurrentPage] = useState(opts.initialPage);
  const currentLimit = opts.initialLimit;

  const url = useMemo(
    () => urlBuilder(currentPage, currentLimit),
    // urlBuilder is stable; currentPage/currentLimit are intentional deps for cache key
    [urlBuilder, currentPage, currentLimit]
  );

  const { serviceName, enableLogging, transformResponse } = opts;
  const queryFn = useCallback(async (): Promise<PaginatedResponse<T>> => {
    if (enableLogging) {
      debugLog.info(`Fetching ${serviceName}`, {
        service: serviceName,
        operation: "fetch-page",
        url,
      });
    }

    const rawResponse = await authenticatedFetchJson<unknown>(url);

    let response: PaginatedResponse<T>;
    if (transformResponse) {
      response = transformResponse(rawResponse) as PaginatedResponse<T>;
    } else {
      response = rawResponse as PaginatedResponse<T>;
    }

    if (enableLogging) {
      debugLog.info(`Successfully fetched ${serviceName}`, {
        service: serviceName,
        operation: "fetch-page",
        itemCount: response?.data?.length || 0,
      });
    }

    return response;
  }, [url, serviceName, enableLogging, transformResponse]);

  const enabled = opts.immediate && !authLoading && !!user;

  const {
    data: response,
    error,
    isLoading,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: ["api", "paginated", url],
    queryFn,
    enabled,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 2000,
  });

  const data = response?.data || [];
  const pagination = response?.pagination || null;
  const errorMessage = error ? opts.formatError(error) : null;

  const fetchPage = useCallback(async (page: number) => {
    setCurrentPage(page);
  }, []);

  const fetchNext = useCallback(async () => {
    if (pagination?.hasMore) {
      fetchPage(currentPage + 1);
    }
  }, [pagination, currentPage, fetchPage]);

  const fetchPrevious = useCallback(async () => {
    if (currentPage > 1) {
      fetchPage(currentPage - 1);
    }
  }, [currentPage, fetchPage]);

  const refetch = useCallback(async () => {
    await refetchQuery();
  }, [refetchQuery]);

  const reset = useCallback(() => {
    setCurrentPage(opts.initialPage);
  }, [opts.initialPage]);

  return {
    data,
    loading: isLoading,
    error: errorMessage,
    pagination,
    fetchPage,
    fetchNext,
    fetchPrevious,
    refetch,
    reset,
  };
}
