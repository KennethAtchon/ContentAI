import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { TimeService } from "@/shared/services/timezone/TimeService";
import type {
  AssetsResponse,
  AttachMusicRequest,
  GenerateVoiceoverRequest,
  GenerateVoiceoverResponse,
  MusicLibraryFilters,
  MusicLibraryResponse,
  ReelAsset,
  Voice,
} from "../types/audio.types";

function timezoneHeader() {
  return { "x-timezone": TimeService.getBrowserTimezone() };
}

export const audioService = {
  getVoices(): Promise<{ voices: Voice[] }> {
    return authenticatedFetchJson("/api/audio/voices", {
      headers: timezoneHeader(),
    });
  },

  getMusicLibrary(filters: MusicLibraryFilters = {}): Promise<MusicLibraryResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.mood) params.set("mood", filters.mood);
    if (filters.durationBucket) params.set("durationBucket", filters.durationBucket);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    const query = params.toString();
    return authenticatedFetchJson(`/api/music/library${query ? `?${query}` : ""}`, {
      headers: timezoneHeader(),
    });
  },

  getContentAssets(
    generatedContentId: number,
    type?: string
  ): Promise<AssetsResponse> {
    const params = new URLSearchParams();
    params.set("generatedContentId", String(generatedContentId));
    if (type) params.set("type", type);
    return authenticatedFetchJson(`/api/assets?${params}`, {
      headers: timezoneHeader(),
    });
  },

  getGeneratedContent(id: number): Promise<{
    content: {
      id: number;
      generatedScript: string | null;
      voiceoverScript: string | null;
      generatedHook: string | null;
      postCaption: string | null;
      outputType: string;
      status: string;
    };
  }> {
    return authenticatedFetchJson(`/api/generation/${id}`, {
      headers: timezoneHeader(),
    });
  },

  attachMusic(data: AttachMusicRequest): Promise<unknown> {
    return authenticatedFetchJson("/api/music/attach", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAssetMetadata(
    assetId: string,
    metadata: Record<string, unknown>
  ): Promise<unknown> {
    return authenticatedFetchJson(`/api/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ metadata }),
    });
  },

  deleteAsset(assetId: string): Promise<unknown> {
    return authenticatedFetchJson(`/api/assets/${assetId}`, {
      method: "DELETE",
    });
  },

  generateVoiceover(data: GenerateVoiceoverRequest): Promise<GenerateVoiceoverResponse> {
    return authenticatedFetchJson("/api/audio/tts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
