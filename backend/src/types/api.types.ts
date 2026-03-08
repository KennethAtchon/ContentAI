/**
 * Shared API Types
 *
 * Common type definitions for API requests and responses.
 * Ensures type consistency across the application.
 */

/**
 * Standard API response structure
 */
export type ApiResponse<T> = {
  data: T;
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
};

/**
 * Standard API error response structure
 */
export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

/**
 * Pagination metadata
 */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

/**
 * Paginated response structure
 */
export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

/**
 * Async state type for components
 */
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};
