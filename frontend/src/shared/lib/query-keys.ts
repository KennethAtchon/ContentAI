/**
 * Centralized query keys for React Query.
 * Use for consistent cache keys and invalidation (e.g. by prefix or predicate).
 * Keys: profile, reels, subscriptions, usage, settings, admin (config, status), studio.
 *
 * Cross-resource invalidation (admin save → customer cache, etc.): see
 * `query-invalidation.ts` and extend mappings there when adding dependent queries.
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
    /** Prefix for all `/api/users/...` queries (e.g. admin order form user picker) */
    usersQueriesRoot: () => ["api", "users"] as const,
    usersList: (url: string) => ["api", "users", "list", url] as const,
    userSettings: () => ["api", "customer", "settings"] as const,
    /** Account page voice list (`/api/audio/voices`); keep in sync with TTS system config */
    userSettingsVoices: () =>
      [...queryKeys.api.userSettings(), "voices"] as const,
    admin: {
      /** Prefix-invalidates any paginated admin orders query */
      ordersRoot: () => ["api", "admin", "orders"] as const,
      orders: (params?: { page?: number; limit?: number }) =>
        ["api", "admin", "orders", params] as const,
      users: () => ["api", "admin", "users"] as const,
      customers: (params?: { page?: number; limit?: number; search?: string }) =>
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
      /** Prefix for all niche reel list queries for a niche */
      nicheReelsPrefix: (nicheId: number) =>
        ["api", "admin", "niche-reels", nicheId] as const,
      nichesRoot: () => ["api", "admin", "niches"] as const,
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
      musicRoot: () => ["api", "admin", "music"] as const,
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
    generationHistoryRoot: () => ["api", "generation-history"] as const,
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
    queueRoot: () => ["api", "queue"] as const,
    queueDetail: (id: number) => ["api", "queue-detail", id] as const,
    projects: () => ["api", "projects"] as const,
    project: (id: string) => ["api", "projects", id] as const,
    /** Studio chat sessions: list + detail share this prefix */
    chatSessionsRoot: () => ["chat-sessions"] as const,
    chatSession: (sessionId: string) => ["chat-sessions", sessionId] as const,
    audioVoices: () => ["api", "audio", "voices"] as const,
    musicLibrary: (filters?: {
      search?: string;
      mood?: string;
      durationBucket?: string;
      page?: number;
    }) => ["api", "music", "library", filters] as const,
    contentAssets: (generatedContentId: number, type?: string) =>
      ["api", "assets", generatedContentId, type] as const,
    /** Prefix-invalidates all asset-type slices for one generated content id */
    contentAssetsPrefix: (generatedContentId: number) =>
      ["api", "assets", generatedContentId] as const,
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
    editorByContent: (contentId?: number) =>
      ["api", "editor", "by-content", contentId] as const,
    editorAssets: (contentId?: number) =>
      ["api", "editor", "assets", contentId] as const,
    captionDocByAsset: (assetId: string) =>
      ["api", "captions", "asset", assetId] as const,
    captionDoc: (captionDocId: string) =>
      ["api", "captions", "doc", captionDocId] as const,
    captionPresets: () => ["api", "captions", "presets"] as const,

    mediaLibrary: () => ["api", "media", "library"] as const,

    /** Paginated list key prefix; full key includes url or resource id */
    paginated: (resource: string, params: Record<string, unknown>) =>
      ["api", "paginated", resource, params] as const,
  },
};
