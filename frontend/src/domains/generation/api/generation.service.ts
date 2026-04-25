import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import { TimeService } from "@/shared/time/timezone/TimeService";
import type { GeneratedContent } from "@/domains/reels/model/reel.types";

function timezoneHeader() {
  return { "x-timezone": TimeService.getBrowserTimezone() };
}

export const generationService = {
  getHistory(): Promise<{ items: GeneratedContent[]; total: number }> {
    return authenticatedFetchJson("/api/generation?limit=20", {
      headers: timezoneHeader(),
    });
  },

  generateContent(params: {
    sourceReelId: number;
    prompt: string;
    outputType?: "hook" | "caption" | "full";
  }): Promise<{ content: GeneratedContent }> {
    return authenticatedFetchJson("/api/generation", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  queueContent(params: {
    contentId: number;
    scheduledFor?: string;
    instagramPageId?: string;
  }): Promise<unknown> {
    return authenticatedFetchJson(`/api/generation/${params.contentId}/queue`, {
      method: "POST",
      body: JSON.stringify({
        scheduledFor: params.scheduledFor,
        instagramPageId: params.instagramPageId,
      }),
    });
  },
};
