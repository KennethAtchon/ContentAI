export interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "male" | "female" | "neutral";
  previewUrl: string;
  provider: string;
}

export type TTSSpeed = "slow" | "normal" | "fast";

export interface GenerateVoiceoverRequest {
  generatedContentId: number;
  text: string;
  voiceId: string;
  speed: TTSSpeed;
}

export interface GenerateVoiceoverResponse {
  asset: ReelAsset;
  audioUrl: string;
}

export interface MusicTrack {
  id: string;
  name: string;
  artistName: string | null;
  durationSeconds: number;
  mood: string;
  genre?: string | null;
  previewUrl: string;
  isSystemTrack: boolean;
}

export interface MusicLibraryFilters {
  search?: string;
  mood?: string;
  durationBucket?: "15" | "30" | "60";
  page?: number;
  limit?: number;
}

export interface MusicLibraryResponse {
  tracks: MusicTrack[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface AttachMusicRequest {
  generatedContentId: number;
  musicTrackId: string;
}

export interface ReelAsset {
  id: string;
  generatedContentId: number;
  userId: string;
  type: "voiceover" | "music" | "video_clip" | "image";
  r2Key: string;
  r2Url: string | null;
  audioUrl?: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssetsResponse {
  assets: ReelAsset[];
}
