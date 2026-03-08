/**
 * Pagination utility functions for consistent API responses
 * Based on the successful pattern from admin/customers endpoint
 */

export interface PaginationParams {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  minLimit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
  showing: number;
  from: number;
  to: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Parse and validate pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: PaginationParams,
  options: PaginationOptions = {},
): { page: number; limit: number; skip: number; search: string } {
  const { defaultLimit = 20, maxLimit = 100, minLimit = 1 } = options;

  const parsedPage = parseInt(searchParams.page || "1");
  const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const limitStr = searchParams.limit || defaultLimit.toString();
  const parsedLimit = parseInt(limitStr);
  let limit: number;

  if (isNaN(parsedLimit) || parsedLimit < 0) {
    // Invalid values or negative numbers default to defaultLimit
    limit = defaultLimit;
  } else {
    // Valid non-negative numbers (parseInt truncates decimals): enforce min/max bounds
    limit = Math.min(maxLimit, Math.max(minLimit, parsedLimit));
  }
  const search = searchParams.search?.trim() || "";
  const skip = (page - 1) * limit;

  return { page, limit, skip, search };
}

/**
 * Create pagination metadata for responses
 */
export function createPaginationMeta(
  totalCount: number,
  page: number,
  limit: number,
  resultCount: number,
): PaginationMeta {
  const totalPages = Math.ceil(totalCount / limit);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;
  const skip = (page - 1) * limit;

  return {
    total: totalCount,
    page,
    limit,
    totalPages,
    hasMore,
    hasPrevious,
    showing: resultCount,
    from: skip + 1,
    to: skip + resultCount,
  };
}

/**
 * Create a standard paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const pagination = createPaginationMeta(totalCount, page, limit, data.length);

  return {
    data,
    pagination,
  };
}

/**
 * Create search conditions for case-insensitive text search
 */
export function createSearchConditions(
  search: string,
  fields: string[],
): Record<string, any> | undefined {
  if (!search || search.length < 2) return undefined;

  if (fields.length === 1) {
    return {
      [fields[0]]: {
        contains: search,
        mode: "insensitive" as const,
      },
    };
  }

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: search,
        mode: "insensitive" as const,
      },
    })),
  };
}

/**
 * Create date range conditions for filtering
 */
export function createDateRangeConditions(
  dateFrom?: string | null,
  dateTo?: string | null,
  dateField = "createdAt",
): Record<string, any> | undefined {
  if (!dateFrom && !dateTo) return undefined;

  const conditions: Record<string, any> = {};

  if (dateFrom !== null && dateFrom !== undefined) {
    conditions.gte = new Date(dateFrom);
  }

  if (dateTo !== null && dateTo !== undefined) {
    conditions.lte = new Date(dateTo);
  }

  return { [dateField]: conditions };
}
