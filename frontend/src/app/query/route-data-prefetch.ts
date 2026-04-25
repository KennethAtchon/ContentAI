import type { QueryClient } from "@tanstack/react-query";
import { auth } from "@/shared/platform/firebase-services/config";
import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import { TimeService } from "@/shared/time/timezone/TimeService";
import { queryKeys } from "@/app/query/query-keys";

function tzHeaders(): Record<string, string> {
  return { "x-timezone": TimeService.getBrowserTimezone() };
}

/**
 * Runs prefetch only when Firebase has a session; swallows errors so navigation
 * still works while auth is restoring or on transient network failures.
 */
async function prefetchWhenSignedIn(run: () => Promise<void>): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await run();
  } catch {
    /* component mount will refetch */
  }
}

/** Matches `QueueView` initial list filters (all projects / all statuses / no search). */
const QUEUE_LIST_PARAMS = {
  status: undefined as string | undefined,
  projectId: undefined as string | undefined,
  search: undefined as string | undefined,
};

export async function prefetchAdminCustomersList(
  queryClient: QueryClient
): Promise<void> {
  const page = 1;
  const limit = 20;
  const search = "";
  const url = `/api/users?page=${page}&limit=${limit}`;
  await prefetchWhenSignedIn(() =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.api.admin.customers({ page, limit, search }),
      queryFn: () => authenticatedFetchJson(url, { headers: tzHeaders() }),
    })
  );
}

interface OrdersApiResponse {
  orders?: unknown[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function prefetchAdminOrdersFirstPage(
  queryClient: QueryClient
): Promise<void> {
  const limit = 20;
  const url = `/api/admin/orders?page=1&limit=${limit}`;
  await prefetchWhenSignedIn(() =>
    queryClient.prefetchQuery({
      queryKey: ["api", "paginated", url],
      queryFn: async () => {
        const raw = await authenticatedFetchJson<OrdersApiResponse>(url, {
          headers: tzHeaders(),
        });
        const list = raw.orders ?? [];
        const p = raw.pagination ?? {
          total: list.length,
          page: 1,
          limit,
          totalPages: 1,
          hasMore: false,
        };
        return {
          data: list,
          pagination: {
            page: p.page,
            limit: p.limit,
            total: p.total,
            totalPages: p.totalPages,
            hasMore: p.hasMore,
          },
        };
      },
    })
  );
}

interface SubscriptionsApiResponse {
  subscriptions?: unknown[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function prefetchAdminSubscriptionsFirstPage(
  queryClient: QueryClient
): Promise<void> {
  const limit = 20;
  const url = `/api/admin/subscriptions?page=1&limit=${limit}`;
  await prefetchWhenSignedIn(() =>
    queryClient.prefetchQuery({
      queryKey: ["api", "paginated", url],
      queryFn: async () => {
        const raw = await authenticatedFetchJson<SubscriptionsApiResponse>(
          url,
          {
            headers: tzHeaders(),
          }
        );
        const list = Array.isArray(raw.subscriptions) ? raw.subscriptions : [];
        const p = raw.pagination ?? {
          total: list.length,
          page: 1,
          limit,
          totalPages: 1,
          hasMore: false,
        };
        return {
          data: list,
          pagination: {
            page: p.page,
            limit: p.limit,
            total: p.total,
            totalPages: p.totalPages,
            hasMore: p.hasMore,
          },
        };
      },
    })
  );
}

export async function prefetchAdminDashboard(
  queryClient: QueryClient
): Promise<void> {
  await prefetchWhenSignedIn(async () => {
    const h = tzHeaders();
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.api.admin.customersCount(),
        queryFn: () =>
          authenticatedFetchJson("/api/users/customers-count", { headers: h }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.api.admin.conversion(),
        queryFn: () =>
          authenticatedFetchJson("/api/admin/analytics", { headers: h }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.api.admin.revenue(),
        queryFn: () =>
          authenticatedFetchJson("/api/customer/orders/total-revenue", {
            headers: h,
          }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.api.admin.subscriptionsAnalytics(),
        queryFn: () =>
          authenticatedFetchJson("/api/admin/subscriptions/analytics", {
            headers: h,
          }),
      }),
    ]);
  });
}

export async function prefetchStudioDiscover(
  queryClient: QueryClient
): Promise<void> {
  await prefetchWhenSignedIn(() =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.api.reelNiches(),
      queryFn: () =>
        authenticatedFetchJson("/api/reels/niches", { headers: tzHeaders() }),
    })
  );
}

export async function prefetchStudioQueue(
  queryClient: QueryClient
): Promise<void> {
  await prefetchWhenSignedIn(async () => {
    const h = tzHeaders();
    const listUrl = "/api/queue?limit=20";
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.api.queue(QUEUE_LIST_PARAMS),
        queryFn: () =>
          authenticatedFetchJson<{ items: unknown[]; total: number }>(listUrl, {
            headers: h,
          }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.api.projects(),
        queryFn: () => authenticatedFetchJson("/api/projects", { headers: h }),
      }),
    ]);
  });
}

export async function prefetchAccountOverview(
  queryClient: QueryClient
): Promise<void> {
  await prefetchWhenSignedIn(() =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.api.usageStats(),
      queryFn: () =>
        authenticatedFetchJson("/api/customer/usage", { headers: tzHeaders() }),
    })
  );
}
