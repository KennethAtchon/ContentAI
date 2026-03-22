/**
 * Centralized query keys for React Query.
 * Use for consistent cache keys and invalidation (e.g. by prefix or predicate).
 * Keys: profile, reels, subscriptions, usage, settings, admin (config, status), studio.
 */

export const queryKeys = {
  api: {
    profile: () => ["api", "customer", "profile"] as const,
    reelsUsage: () => ["api", "reels", "usage"] as const,
    reelsHistory: (params?: { page?: number; limit?: number }) =>
      ["api", "reels", "history", params] as const,
    trialEligibility: () =>
      ["api", "subscriptions", "trial-eligibility"] as const,
    currentSubscription: () => ["api", "subscriptions", "current"] as const,
    portalLink: () => ["api", "subscriptions", "portal-link"] as const,
    usageStats: () => ["api", "account", "usage"] as const,
    userSettings: () => ["api", "customer", "settings"] as const,
    admin: {
      orders: (params?: { page?: number; limit?: number }) =>
        ["api", "admin", "orders", params] as const,
      users: () => ["api", "admin", "users"] as const,
      customers: (params?: { page?: number; limit?: number }) =>
        ["api", "admin", "customers", params] as const,
      dashboard: () => ["api", "admin", "dashboard"] as const,
      customersCount: () => ["api", "users", "customers-count"] as const,
      conversion: () => ["api", "admin", "analytics"] as const,
      revenue: () => ["api", "customer", "orders", "total-revenue"] as const,
      subscriptionsAnalytics: () =>
        ["api", "admin", "subscriptions", "analytics"] as const,
      subscriptions: () => ["api", "admin", "subscriptions"] as const,
      subscriptionStats: () =>
        ["api", "admin", "subscriptions", "stats"] as const,
      aiCosts: (params?: { period?: string }) =>
        ["api", "admin", "ai-costs", params] as const,
      contactMessages: (params?: { page?: number; limit?: number }) =>
        ["api", "shared", "contact-messages", params] as const,
      niches: (params?: { search?: string; active?: boolean }) =>
        ["api", "admin", "niches", params] as const,
      nicheReels: (
        nicheId: number,
        params?: { page?: number; limit?: number }
      ) => ["api", "admin", "niche-reels", nicheId, params] as const,
      nicheJobs: (nicheId: number) =>
        ["api", "admin", "niche-jobs", nicheId] as const,
      systemConfig: (category?: string) =>
        ["api", "admin", "system-config", category] as const,
      aiProvidersStatus: () => ["api", "admin", "ai-providers-status"] as const,
      videoProvidersStatus: () =>
        ["api", "admin", "video-providers-status"] as const,
      apiKeysStatus: () => ["api", "admin", "api-keys-status"] as const,
    },
    aiDefaults: () => ["api", "customer", "ai-defaults"] as const,
    videoDefaults: () => ["api", "customer", "video-defaults"] as const,
    // ── Studio / Reels ──────────────────────────────────────────────
    reelNiches: () => ["api", "reels", "niches"] as const,
    reels: (niche: string, params?: Record<string, unknown>) =>
      ["api", "reels", niche, params] as const,
    reel: (id: number) => ["api", "reel", id] as const,
    reelAnalysis: (id: number) => ["api", "reel-analysis", id] as const,
    generationHistory: (params?: { limit?: number; offset?: number }) =>
      ["api", "generation-history", params] as const,
    audioTrending: (params?: {
      days?: number;
      nicheId?: number | null;
      limit?: number;
    }) => ["api", "audio", "trending", params] as const,
    queue: (params?: {
      status?: string;
      projectId?: string;
      search?: string;
      sort?: string;
      limit?: number;
      offset?: number;
    }) => ["api", "queue", params] as const,
    queueDetail: (id: number) => ["api", "queue-detail", id] as const,
    projects: () => ["api", "projects"] as const,
    audioVoices: () => ["api", "audio", "voices"] as const,
    musicLibrary: (filters?: {
      search?: string;
      mood?: string;
      durationBucket?: string;
      page?: number;
    }) => ["api", "music", "library", filters] as const,
    contentAssets: (generatedContentId: number, type?: string) =>
      ["api", "assets", generatedContentId, type] as const,
    videoJob: (jobId: string) => ["api", "video", "job", jobId] as const,
    videoComposition: (compositionId: string) =>
      ["api", "video", "composition", compositionId] as const,
    videoCompositionVersions: (compositionId: string) =>
      ["api", "video", "composition", compositionId, "versions"] as const,
    videoCompositionJob: (jobId: string) =>
      ["api", "video", "composition-job", jobId] as const,
    videoOutput: (generatedContentId: number) =>
      ["api", "video", "output", generatedContentId] as const,
    generatedContent: (id: number) => ["api", "generation", id] as const,
    sessionDrafts: (sessionId: string) =>
      ["api", "session-drafts", sessionId] as const,

    // ── Editor ──────────────────────────────────────────────────────
    editorProjects: () => ["api", "editor", "projects"] as const,
    editorProject: (id: string) => ["api", "editor", "project", id] as const,
    editorExportStatus: (projectId: string) =>
      ["api", "editor", "export-status", projectId] as const,
    captionsByAsset: (assetId: string) =>
      ["captions", "asset", assetId] as const,
    editorByContent: (contentId?: number) =>
      ["api", "editor", "by-content", contentId] as const,
    editorAssets: (contentId?: number) =>
      ["api", "editor", "assets", contentId] as const,

    mediaLibrary: () => ["api", "media", "library"] as const,

    /** Paginated list key prefix; full key includes url or resource id */
    paginated: (resource: string, params: Record<string, unknown>) =>
      ["api", "paginated", resource, params] as const,
  },
};
