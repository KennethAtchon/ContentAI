import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

/**
 * All React Query cache invalidation should go through this module so
 * cross-key relationships stay in one place. When you add a mutation, add or
 * reuse a helper here; avoid calling `invalidateQueries` ad hoc in features.
 *
 * Mutation convention:
 * - user-triggered mutations should surface `toast.error(...)` on failure
 * - delete mutations should remove deleted entity queries, then invalidate lists
 */

const ADMIN_SYSTEM_CONFIG_PREFIX = ["api", "admin", "system-config"] as const;

// ── Admin: system config ─────────────────────────────────────────────────────

export async function invalidateAfterAdminSystemConfigSave(
  queryClient: QueryClient,
  category: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.admin.systemConfig(category),
  });

  switch (category) {
    case "ai":
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.aiDefaults(),
      });
      break;
    case "video":
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoDefaults(),
      });
      break;
    case "tts":
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.audioVoices(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.userSettingsVoices(),
      });
      break;
    default:
      break;
  }
}

export async function invalidateAfterAdminSystemConfigCacheFlush(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: [...ADMIN_SYSTEM_CONFIG_PREFIX],
  });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.aiDefaults(),
  });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.videoDefaults(),
  });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.audioVoices(),
  });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.userSettingsVoices(),
  });
}

export async function invalidateAdminApiKeysStatus(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.admin.apiKeysStatus(),
  });
}

// ── Admin: orders & users pickers ───────────────────────────────────────────

export async function invalidateAfterAdminOrderSave(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.admin.ordersRoot(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.usersQueriesRoot(),
    }),
  ]);
}

// ── Admin: niches & reels ─────────────────────────────────────────────────────

export async function invalidateAdminNichesQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.admin.nichesRoot(),
  });
}

export async function invalidateAdminNicheJobs(
  queryClient: QueryClient,
  nicheId: number
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.admin.nicheJobs(nicheId),
  });
}

export async function invalidateAdminNicheReelsForNiche(
  queryClient: QueryClient,
  nicheId: number
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.admin.nicheReelsPrefix(nicheId),
  });
}

export async function invalidateAdminNicheReelsAndNichesList(
  queryClient: QueryClient,
  nicheId: number
): Promise<void> {
  await Promise.all([
    invalidateAdminNicheReelsForNiche(queryClient, nicheId),
    invalidateAdminNichesQueries(queryClient),
  ]);
}

// ── Admin: music library ──────────────────────────────────────────────────────

export async function invalidateAdminMusicTracksQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.admin.musicRoot(),
  });
}

// ── Queue & generation history ────────────────────────────────────────────────

export async function invalidateQueueQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.queueRoot(),
  });
}

export async function invalidateGenerationHistoryQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.generationHistoryRoot(),
  });
}

export async function invalidateQueueAndGenerationHistory(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    invalidateQueueQueries(queryClient),
    invalidateGenerationHistoryQueries(queryClient),
  ]);
}

// ── Chat: projects & sessions ─────────────────────────────────────────────────

export async function invalidateChatProjectsQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.projects(),
  });
}

export async function invalidateChatProjectQueries(
  queryClient: QueryClient,
  projectId: string
): Promise<void> {
  await Promise.all([
    invalidateChatProjectsQueries(queryClient),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.project(projectId),
    }),
  ]);
}

export async function invalidateChatSessionsQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.chatSessionsRoot(),
  });
}

export function removeDeletedEntityQueries(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void {
  queryClient.removeQueries({ queryKey });
}

export async function invalidateChatSessionQuery(
  queryClient: QueryClient,
  sessionId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.chatSession(sessionId),
  });
}

export async function invalidateSessionDraftsQuery(
  queryClient: QueryClient,
  sessionId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.sessionDrafts(sessionId),
  });
}

export function removeDeletedChatSessionQueries(
  queryClient: QueryClient,
  sessionId: string
): void {
  removeDeletedEntityQueries(queryClient, queryKeys.api.chatSession(sessionId));
  removeDeletedEntityQueries(
    queryClient,
    queryKeys.api.sessionDrafts(sessionId)
  );
}

export function removeDeletedChatProjectQueries(
  queryClient: QueryClient,
  projectId: string
): void {
  removeDeletedEntityQueries(queryClient, queryKeys.api.project(projectId));
}

export async function invalidateAfterChatMessageSent(
  queryClient: QueryClient,
  sessionId: string
): Promise<void> {
  await Promise.all([
    invalidateChatSessionQuery(queryClient, sessionId),
    invalidateSessionDraftsQuery(queryClient, sessionId),
    invalidateChatSessionsQueries(queryClient),
  ]);
}

// ── Session drafts (studio workspace) ─────────────────────────────────────────

const SESSION_DRAFT_VISIBILITY_RETRY_DELAYS_MS = [
  0, 150, 300, 600, 1000,
] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureSessionDraftVisible(
  queryClient: QueryClient,
  sessionId: string,
  contentId: number,
  fetchDrafts: () => Promise<{ drafts: Array<{ id: number }> }>,
  options?: {
    retryDelaysMs?: readonly number[];
    wait?: (ms: number) => Promise<void>;
  }
): Promise<void> {
  const retryDelaysMs =
    options?.retryDelaysMs ?? SESSION_DRAFT_VISIBILITY_RETRY_DELAYS_MS;
  const waitForRetry = options?.wait ?? wait;

  // A newly streamed content id can arrive before the session drafts read path
  // catches up. Keep refetching the real server-backed query until that id is
  // actually visible in the cache, rather than rendering a guessed draft.
  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) {
      await waitForRetry(delayMs);
    }

    const data = await queryClient.fetchQuery({
      queryKey: queryKeys.api.sessionDrafts(sessionId),
      queryFn: fetchDrafts,
    });

    if (data.drafts.some((draft) => draft.id === contentId)) {
      return;
    }
  }
}

// ── Generated content, assets, video jobs ─────────────────────────────────────

export async function invalidateContentAssetsForGeneration(
  queryClient: QueryClient,
  generatedContentId: number
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.contentAssetsPrefix(generatedContentId),
  });
}

export async function invalidateGeneratedContent(
  queryClient: QueryClient,
  id: number
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.generatedContent(id),
  });
}

export async function invalidateVideoJob(
  queryClient: QueryClient,
  jobId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.videoJob(jobId),
  });
}

export async function invalidateAfterGenerateReel(
  queryClient: QueryClient,
  generatedContentId: number,
  jobId: string
): Promise<void> {
  await Promise.all([
    invalidateGeneratedContent(queryClient, generatedContentId),
    invalidateContentAssetsForGeneration(queryClient, generatedContentId),
    invalidateVideoJob(queryClient, jobId),
  ]);
}

export async function invalidateAfterRegenerateShot(
  queryClient: QueryClient,
  generatedContentId: number,
  jobId: string
): Promise<void> {
  await Promise.all([
    invalidateContentAssetsForGeneration(queryClient, generatedContentId),
    invalidateVideoJob(queryClient, jobId),
  ]);
}

// ── Editor ────────────────────────────────────────────────────────────────────

export async function invalidateEditorProjectsQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.editorProjects(),
  });
}

export async function invalidateEditorProjectQuery(
  queryClient: QueryClient,
  projectId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.editorProject(projectId),
  });
}

export function removeDeletedEditorProjectQuery(
  queryClient: QueryClient,
  projectId: string
): void {
  removeDeletedEntityQueries(
    queryClient,
    queryKeys.api.editorProject(projectId)
  );
}

// ── Media library (customer) ──────────────────────────────────────────────────

export async function invalidateMediaLibraryQueries(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.mediaLibrary(),
  });
}

// ── Account settings ────────────────────────────────────────────────────────────

export async function invalidateUserSettingsQuery(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.userSettings(),
  });
}

// ── Usage & subscriptions (customer + admin dashboards) ───────────────────────

export async function invalidateReelsUsageAndUsageStats(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.reelsUsage(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.usageStats(),
    }),
  ]);
}

export async function invalidateUsageStatsAndGenerationHistory(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.usageStats(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.generationHistoryRoot(),
    }),
  ]);
}

export async function invalidateCustomerSubscriptionSummary(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.usageStats(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.reelsUsage(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.currentSubscription(),
    }),
  ]);
}

export async function invalidateAfterSubscriptionRoleChange(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.reelsUsage(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.usageStats(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.currentSubscription(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.portalLink(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.admin.subscriptions(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.admin.subscriptionsAnalytics(),
    }),
  ]);
}

export async function invalidateCaptionDocQuery(
  queryClient: QueryClient,
  captionDocId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.api.captionDoc(captionDocId),
  });
}

export async function invalidateCaptionQueriesAfterTranscription(
  queryClient: QueryClient,
  assetId: string,
  captionDocId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.captionDocByAsset(assetId),
    }),
    invalidateCaptionDocQuery(queryClient, captionDocId),
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.captionPresets(),
    }),
  ]);
}
