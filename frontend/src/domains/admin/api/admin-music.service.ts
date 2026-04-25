import {
  authenticatedFetch,
  authenticatedFetchJson,
} from "@/shared/api/authenticated-fetch";
import type { AdminMusicTrack } from "../model";

export const adminMusicService = {
  list(search?: string) {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    return authenticatedFetchJson<{ tracks: AdminMusicTrack[] }>(
      `/api/admin/music${params}`
    );
  },

  async upload(formData: FormData) {
    const res = await authenticatedFetch("/api/admin/music", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Upload failed");
    }
    return res.json() as Promise<{ track: AdminMusicTrack }>;
  },

  toggleActive(id: string, isActive: boolean) {
    return authenticatedFetchJson<{ track: AdminMusicTrack }>(
      `/api/admin/music/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }
    );
  },

  remove(id: string) {
    return authenticatedFetchJson(`/api/admin/music/${id}`, {
      method: "DELETE",
    });
  },
};
