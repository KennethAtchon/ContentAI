// ─── Shared account types ─────────────────────────────────────────────────────

export type Section =
  | "overview"
  | "subscription"
  | "usage"
  | "orders"
  | "preferences"
  | "profile";

export interface SidebarUsage {
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number | null;
  contentGenerated: number;
  contentGeneratedLimit: number | null;
  queueSize: number;
  queueLimit: number | null;
}

export type UserSettingsData = {
  preferredAiProvider?: string | null;
  preferredVideoProvider?: string | null;
  preferredVoiceId?: string | null;
  preferredTtsSpeed?: string | null;
  preferredAspectRatio?: string | null;
};

export type AiDefaultsData = {
  defaultProvider: string | null;
  defaultProviderLabel: string | null;
  analysisModel: string | null;
  generationModel: string | null;
};

export type VideoDefaultsData = {
  defaultProvider: string | null;
  defaultProviderLabel: string | null;
};

export type Voice = {
  id: string;
  name: string;
  description: string;
  gender: string;
  previewUrl?: string;
};
