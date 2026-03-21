export interface MediaItem {
  id: string;
  userId: string;
  name: string;
  type: "video" | "image" | "audio";
  mimeType: string;
  r2Url: string | null;
  mediaUrl?: string; // fresh signed URL from backend
  sizeBytes: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UploadMediaRequest {
  file: File;
  name?: string;
}

export interface MediaLibraryResponse {
  items: MediaItem[];
}

export interface UploadMediaResponse {
  item: MediaItem;
}
