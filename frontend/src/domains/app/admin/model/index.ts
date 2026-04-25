export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface ScrapeJob {
  id: string;
  nicheId: number;
  nicheName: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: { saved: number; skipped: number; durationMs: number };
  error?: string;
}

export interface AdminNiche {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  reelCount: number;
  scrapeLimit: number | null;
  scrapeMinViews: number | null;
  scrapeMaxDaysOld: number | null;
  scrapeIncludeViralOnly: boolean | null;
}

export interface AdminNicheReel {
  id: number;
  username: string;
  nicheId: number;
  views: number;
  likes: number;
  comments: number;
  engagementRate: string | null;
  hook: string | null;
  caption: string | null;
  audioName: string | null;
  thumbnailEmoji: string | null;
  thumbnailR2Url: string | null;
  videoR2Url: string | null;
  isViral: boolean;
  hasAnalysis: boolean;
  createdAt: string;
}

export interface NicheReelsResponse {
  niche: AdminNiche;
  reels: AdminNicheReel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NicheReelsParams {
  page?: number;
  limit?: number;
  sortBy?: "views" | "likes" | "engagement" | "postedAt" | "scrapedAt";
  sortOrder?: "asc" | "desc";
  viral?: "true" | "false";
  hasVideo?: "true";
}

export interface ScrapeConfigOverride {
  limit?: number;
  minViews?: number;
  maxDaysOld?: number;
  viralOnly?: boolean;
}

export interface AdminMusicTrack {
  id: string;
  name: string;
  artistName: string | null;
  durationSeconds: number;
  mood: string;
  genre: string | null;
  r2Key: string;
  isActive: boolean;
  uploadedBy: string | null;
  createdAt: string;
}
