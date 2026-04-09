import {
  authenticatedFetch,
  authenticatedFetchJson,
} from "@/shared/services/api/authenticated-fetch";
import type {
  AdminNiche,
  NicheReelsParams,
  NicheReelsResponse,
  ScrapeConfigOverride,
  ScrapeJob,
} from "../types";

function buildNichesQuery(params?: {
  search?: string;
  active?: boolean;
}): string {
  const qp = new URLSearchParams();
  if (params?.search) qp.set("search", params.search);
  if (params?.active !== undefined) qp.set("active", String(params.active));
  const qs = qp.toString();
  return qs ? `?${qs}` : "";
}

function buildReelsQuery(params: NicheReelsParams): string {
  const { page = 1, limit = 50, sortBy, sortOrder, viral, hasVideo } = params;
  const qp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (sortBy) qp.set("sortBy", sortBy);
  if (sortOrder) qp.set("sortOrder", sortOrder);
  if (viral) qp.set("viral", viral);
  if (hasVideo) qp.set("hasVideo", hasVideo);
  return qp.toString();
}

export const nichesService = {
  list(params?: { search?: string; active?: boolean }) {
    return authenticatedFetchJson<{ niches: AdminNiche[] }>(
      `/api/admin/niches${buildNichesQuery(params)}`
    );
  },

  create(body: { name: string; description?: string; isActive?: boolean }) {
    return authenticatedFetchJson<{ niche: AdminNiche }>("/api/admin/niches", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update(
    id: number,
    body: { name?: string; description?: string; isActive?: boolean }
  ) {
    return authenticatedFetchJson<{ niche: AdminNiche }>(
      `/api/admin/niches/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
  },

  remove(id: number) {
    return authenticatedFetchJson<{ deleted: boolean }>(
      `/api/admin/niches/${id}`,
      {
        method: "DELETE",
      }
    );
  },

  listReels(nicheId: number, params: NicheReelsParams = {}) {
    return authenticatedFetchJson<NicheReelsResponse>(
      `/api/admin/niches/${nicheId}/reels?${buildReelsQuery(params)}`
    );
  },

  listJobs(nicheId: number) {
    return authenticatedFetchJson<{ jobs: ScrapeJob[] }>(
      `/api/admin/niches/${nicheId}/jobs`
    );
  },

  scan(nicheId: number, config?: ScrapeConfigOverride) {
    return authenticatedFetchJson<{
      jobId: string;
      nicheName: string;
      status: string;
      nicheId: number;
    }>(`/api/admin/niches/${nicheId}/scan`, {
      method: "POST",
      body: JSON.stringify(config ?? {}),
    });
  },

  dedupe(nicheId: number) {
    return authenticatedFetchJson<{
      duplicatesRemoved: number;
      message: string;
    }>(`/api/admin/niches/${nicheId}/dedupe`, {
      method: "POST",
    });
  },

  async deleteReel(reelId: number) {
    const res = await authenticatedFetch(`/api/admin/reels/${reelId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete reel");
  },
};
