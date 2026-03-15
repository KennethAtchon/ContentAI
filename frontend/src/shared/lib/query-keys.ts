/**
 * Centralized query keys for React Query.
 * Use for consistent cache keys and invalidation (e.g. by prefix or predicate).
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
    },
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

    /** Paginated list key prefix; full key includes url or resource id */
    paginated: (resource: string, params: Record<string, unknown>) =>
      ["api", "paginated", resource, params] as const,
  },
};
