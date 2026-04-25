export interface Reel {
  id: number;
  username: string;
  niche: string;
  views: number;
  likes: number;
  comments: number;
  engagementRate: string | null;
  hook: string | null;
  thumbnailEmoji: string | null;
  // Always R2 URLs — never Instagram CDN URLs
  thumbnailR2Url: string | null;
  videoR2Url: string | null;
  daysAgo: number | null;
  isViral: boolean;
  audioName: string | null;
  hasAnalysis: boolean;
  createdAt: string;
}

export interface ReelDetail {
  id: number;
  username: string;
  niche: string;
  views: number;
  likes: number;
  comments: number;
  engagementRate: string | null;
  hook: string | null;
  caption: string | null;
  audioName: string | null;
  audioId: string | null;
  thumbnailEmoji: string | null;
  daysAgo: number | null;
  isViral: boolean;
  createdAt: string;
}

export interface GeneratedContent {
  id: number;
  userId: string;
  sourceReelId: number | null;
  prompt: string;
  generatedHook: string | null;
  postCaption: string | null;
  generatedScript: string | null;
  outputType: string;
  model: string | null;
  status: "draft" | "queued" | "posted";
  createdAt: string;
}

export type PipelineStageStatus = "pending" | "running" | "ok" | "failed";

export interface PipelineStage {
  id: string;
  label: string;
  status: PipelineStageStatus;
  error?: string;
}

export interface QueueItem {
  id: number;
  userId: string;
  generatedContentId: number | null;
  scheduledFor: string | null;
  postedAt: string | null;
  instagramPageId: string | null;
  status: "draft" | "ready" | "scheduled" | "posted" | "failed";
  errorMessage: string | null;
  createdAt: string;
  // Preview from generatedContent
  generatedHook: string | null;
  postCaption: string | null;
  thumbnailR2Key: string | null;
  version: number | null;
  // Project info (populated when content was generated via chat)
  projectId: string | null;
  projectName: string | null;
  sessionId: string | null;
  // Pipeline stages derived server-side
  stages: PipelineStage[];
  // Version chain grouping — root content ID shared by all versions in the chain
  rootContentId: number | null;
  // Total number of versions in this content's chain
  versionCount: number;
}
