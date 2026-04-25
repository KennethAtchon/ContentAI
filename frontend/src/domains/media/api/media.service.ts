import { authenticatedFetch } from "@/shared/api/authenticated-fetch";
import type {
  MediaLibraryResponse,
  UploadMediaResponse,
} from "../model/media.types";

export const mediaService = {
  async list(): Promise<MediaLibraryResponse> {
    const response = await authenticatedFetch("/api/media");
    if (!response.ok) throw new Error("Failed to fetch media library");
    return response.json();
  },

  async upload(file: File, name?: string): Promise<UploadMediaResponse> {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);

    const response = await authenticatedFetch("/api/media/upload", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? "Failed to upload media"
      );
    }
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await authenticatedFetch(`/api/media/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete media item");
  },
};
