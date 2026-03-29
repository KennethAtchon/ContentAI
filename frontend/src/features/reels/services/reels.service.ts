import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { TimeService } from "@/shared/services/timezone/TimeService";
import type { Reel, ReelDetail } from "../types/reel.types";

function timezoneHeader() {
  return { "x-timezone": TimeService.getBrowserTimezone() };
}

export const reelsService = {
  getNiches(): Promise<{ niches: { id: number; name: string }[] }> {
    return authenticatedFetchJson("/api/reels/niches", {
      headers: timezoneHeader(),
    });
  },

  getReels(params: {
    niche?: string;
    nicheId?: number | null;
    sort?: string;
    offset?: number;
  }): Promise<{ reels: Reel[]; total: number; niche: string }> {
    const { niche, nicheId, sort = "views", offset = 0 } = params;
    const search = new URLSearchParams({ limit: "20", offset: String(offset), sort });
    if (nicheId != null) search.set("nicheId", String(nicheId));
    if (niche) search.set("niche", niche);
    return authenticatedFetchJson(`/api/reels?${search}`, {
      headers: timezoneHeader(),
    });
  },

  getReel(id: number): Promise<{ reel: ReelDetail }> {
    return authenticatedFetchJson(`/api/reels/${id}`, {
      headers: timezoneHeader(),
    });
  },

  getMediaUrl(reelId: number): Promise<{ url: string }> {
    return authenticatedFetchJson(`/api/reels/${reelId}/media-url`, {
      headers: timezoneHeader(),
    });
  },

  getBulkReels(ids: number[]): Promise<{ reels: Reel[] }> {
    return authenticatedFetchJson("/api/reels/bulk", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },
};
