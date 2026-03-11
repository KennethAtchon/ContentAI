import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminNiche {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  reelCount: number;
}

export interface AdminNicheReel {
  id: number;
  username: string;
  nicheId: number;
  views: number;
  likes: number;
  comments: number;
  engagementRate: string | null;
  hook: string | null;
  caption: string | null;
  audioName: string | null;
  thumbnailEmoji: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  isViral: boolean;
  hasAnalysis: boolean;
  createdAt: string;
}

export interface NicheReelsResponse {
  niche: AdminNiche;
  reels: AdminNicheReel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useNiches(params?: { search?: string; active?: boolean }) {
  const fetcher = useQueryFetcher<{ niches: AdminNiche[] }>();
  const qp = new URLSearchParams();
  if (params?.search) qp.set("search", params.search);
  if (params?.active !== undefined) qp.set("active", String(params.active));
  const qs = qp.toString() ? `?${qp.toString()}` : "";

  return useQuery({
    queryKey: queryKeys.api.admin.niches(params),
    queryFn: () => fetcher(`/api/admin/niches${qs}`),
  });
}

export function useCreateNiche() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { name: string; description?: string; isActive?: boolean }) => {
      const res = await authenticatedFetch("/api/admin/niches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create niche");
      }
      return res.json() as Promise<{ niche: AdminNiche }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "niches"] });
    },
  });
}

export function useUpdateNiche() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: number;
      name?: string;
      description?: string;
      isActive?: boolean;
    }) => {
      const res = await authenticatedFetch(`/api/admin/niches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update niche");
      }
      return res.json() as Promise<{ niche: AdminNiche }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "niches"] });
    },
  });
}

export function useDeleteNiche() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/admin/niches/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to delete niche");
      }
      return res.json() as Promise<{ deleted: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "niches"] });
    },
  });
}

export function useNicheReels(nicheId: number, page = 1, limit = 50) {
  const fetcher = useQueryFetcher<NicheReelsResponse>();

  return useQuery({
    queryKey: queryKeys.api.admin.nicheReels(nicheId, { page, limit }),
    queryFn: () =>
      fetcher(`/api/admin/niches/${nicheId}/reels?page=${page}&limit=${limit}`),
    enabled: nicheId > 0,
  });
}

export function useScanNiche() {
  const { authenticatedFetch } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async (nicheId: number) => {
      const res = await authenticatedFetch(`/api/admin/niches/${nicheId}/scan`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to queue scan");
      return res.json() as Promise<{ jobId: string; nicheName: string; status: string }>;
    },
  });
}

export function useDedupeNiche() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nicheId: number) => {
      const res = await authenticatedFetch(`/api/admin/niches/${nicheId}/dedupe`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to run deduplication");
      return res.json() as Promise<{ duplicatesRemoved: number; message: string }>;
    },
    onSuccess: (_data, nicheId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.admin.nicheReels(nicheId),
      });
    },
  });
}

export function useDeleteAdminReel() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reelId, nicheId }: { reelId: number; nicheId: number }) => {
      const res = await authenticatedFetch(`/api/admin/reels/${reelId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete reel");
      return { reelId, nicheId };
    },
    onSuccess: ({ nicheId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.admin.nicheReels(nicheId),
      });
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "niches"] });
    },
  });
}
