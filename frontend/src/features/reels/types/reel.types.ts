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
  thumbnailUrl: string | null;
  videoUrl: string | null;
  videoR2Key: string | null;
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

export interface ReelAnalysis {
  id: number;
  reelId: number;
  hookPattern: string | null;
  hookCategory: string | null;
  emotionalTrigger: string | null;
  formatPattern: string | null;
  ctaType: string | null;
  captionFramework: string | null;
  curiosityGapStyle: string | null;
  remixSuggestion: string | null;
  analyzedAt: string;
}

export interface GeneratedContent {
  id: number;
  userId: string;
  sourceReelId: number | null;
  prompt: string;
  generatedHook: string | null;
  generatedCaption: string | null;
  generatedScript: string | null;
  outputType: string;
  model: string | null;
  status: "draft" | "queued" | "posted";
  createdAt: string;
}

export interface QueueItem {
  id: number;
  userId: string;
  generatedContentId: number | null;
  scheduledFor: string | null;
  postedAt: string | null;
  instagramPageId: string | null;
  status: "scheduled" | "posted" | "failed";
  errorMessage: string | null;
  createdAt: string;
}
