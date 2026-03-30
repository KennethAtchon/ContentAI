import { and, desc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { assertNoChainQueueItem } from "../../lib/queue-chain-guard";
import {
  assets,
  chatMessages,
  contentAssets,
  generatedContent,
  queueItems,
  reelAnalyses,
  reels,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

const MAX_CONTENT_CHAIN_DEPTH = 50;

/** Walk `parent_id` from `startId` to the newest child (chain tip). */
export async function resolveGeneratedContentChainTip(
  database: AppDb,
  startId: number,
  userId: string,
): Promise<typeof generatedContent.$inferSelect> {
  const visitedIds = new Set<number>();
  let current = await database
    .select()
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, startId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!current) throw new Error("Content not found");

  visitedIds.add(current.id);
  let depth = 0;

  while (depth < MAX_CONTENT_CHAIN_DEPTH) {
    const [child] = await database
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.parentId, current.id),
          eq(generatedContent.userId, userId),
        ),
      )
      .orderBy(desc(generatedContent.createdAt))
      .limit(1);

    if (!child || visitedIds.has(child.id)) break;
    visitedIds.add(child.id);
    current = child;
    depth++;
  }

  return current;
}

export interface IContentRepository {
  findIdAndHookForUser(
    contentId: number,
    userId: string,
  ): Promise<{ id: number; generatedHook: string | null } | null>;

  /** Content ids from `contentId` up through `parent_id` (includes `contentId`). */
  resolveContentAncestorChainIds(
    contentId: number,
    userId: string,
  ): Promise<number[]>;

  listAssetsLinkedToGeneratedContent(
    generatedContentId: number,
  ): Promise<
    Array<{
      assetId: string;
      role: string | null;
      id: string;
      userId: string | null;
      type: string;
      source: string;
      name: string | null;
      mimeType: string | null;
      r2Url: string | null;
      r2Key: string | null;
      sizeBytes: number | null;
      durationMs: number | null;
      metadata: unknown;
      createdAt: Date | null;
    }>
  >;

  findHookAndVoiceoverForUser(
    contentId: number,
    userId: string,
  ): Promise<{
    generatedHook: string | null;
    voiceoverScript: string | null;
  } | null>;

  // Video metadata operations
  fetchOwnedContentForVideo(
    userId: string,
    generatedContentId: number,
  ): Promise<{
    id: number;
    prompt: string | null;
    generatedHook: string | null;
    generatedScript: string | null;
    voiceoverScript: string | null;
    sceneDescription: string | null;
    generatedMetadata: Record<string, unknown> | null;
  } | null>;

  updatePhase4Metadata(input: {
    generatedContentId: number;
    existingGeneratedMetadata: Record<string, unknown> | null;
    jobId: string;
    status: "queued" | "running" | "completed" | "failed";
    shots?: Array<{
      shotIndex: number;
      description: string;
      durationMs: number;
      assetId: string;
      useClipAudio: boolean;
    }>;
    provider?: string;
  }): Promise<void>;

  // Timeline validation
  fetchOwnedAssetsForTimeline(
    userId: string,
    generatedContentId: number,
    assetIds: string[],
  ): Promise<{ id: string; type: string }[]>;

  // Editor assets
  listEditorAssetsForUser(
    userId: string,
    options: {
      contentId?: number;
      roles?: string[];
      excludeRoles?: string[];
    },
  ): Promise<
    Array<{
      id: string;
      generatedContentId: number;
      role: string | null;
      r2Url: string | null;
      durationMs: number | null;
      sourceHook: string | null;
    }>
  >;

  // Content assets for GET /api/assets
  listContentAssetsForUser(
    userId: string,
    generatedContentId: number,
    options: {
      typeFilter?: string;
    },
  ): Promise<
    Array<{
      id: string;
      userId: string | null;
      type: string;
      source: string;
      name: string | null;
      mimeType: string | null;
      r2Key: string | null;
      r2Url: string | null;
      sizeBytes: number | null;
      durationMs: number | null;
      metadata: unknown;
      createdAt: Date | null;
      role: string | null;
    }>
  >;

  // Chat content operations
  findChainTipDraftsForSession(
    userId: string,
    sessionId: string,
  ): Promise<
    Array<{
      id: number;
      version: number;
      outputType: string | null;
      status: string | null;
      generatedHook: string | null;
      generatedScript: string | null;
      voiceoverScript: string | null;
      postCaption: string | null;
      sceneDescription: string | null;
      generatedMetadata: unknown;
      createdAt: Date | null;
    }>
  >;

  // Generation operations
  listGenerationHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    rows: Array<{
      id: number;
      type: string | null;
      prompt: string | null;
      createdAt: Date | null;
      sourceReelUsername: string | null;
      sourceReelHook: string | null;
    }>;
    total: number;
    totalPages: number;
  }>;

  listGeneratedContent(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: Array<typeof generatedContent.$inferSelect>; total: number }>;

  findGeneratedContentById(
    id: number,
    userId: string,
  ): Promise<typeof generatedContent.$inferSelect | null>;

  updateGeneratedContentStatus(
    id: number,
    userId: string,
    status: string,
  ): Promise<typeof generatedContent.$inferSelect | null>;

  findOwnedGeneratedContentId(
    userId: string,
    generatedContentId: number,
  ): Promise<number | null>;

  insertContentAssetLink(params: {
    generatedContentId: number;
    assetId: string;
    role: string;
  }): Promise<void>;

  insertGeneratedVideoClipAndLink(params: {
    userId: string;
    generatedContentId: number;
    r2Key: string;
    r2Url: string;
    durationMs: number;
    shotIndex: number;
    provider: string;
    generationPrompt: string;
  }): Promise<{ id: string }>;

  replaceGeneratedVideoClipForShot(params: {
    userId: string;
    generatedContentId: number;
    shotIndex: number;
    newClip: {
      r2Key: string;
      r2Url: string;
      durationMs: number;
      provider: string;
      generationPrompt: string;
    };
  }): Promise<{ assetId: string }>;

  /** Video clips for a user's content, ordered by `metadata.shotIndex` (AI assembly). */
  listVideoClipAssetsForAiAssembly(
    userId: string,
    generatedContentId: number,
  ): Promise<
    Array<{ id: string; durationMs: number | null; metadata: unknown }>
  >;

  fetchReelAndAnalysisForGeneration(reelId: number): Promise<{
    reel: typeof reels.$inferSelect;
    analysis: typeof reelAnalyses.$inferSelect | null;
  } | null>;

  createReelGeneratedDraftWithQueueEnrollment(params: {
    userId: string;
    reelId: number;
    prompt: string;
    outputType: string;
    generatedHook: string | null;
    postCaption: string | null;
    generatedScript: string | null;
    model: string;
  }): Promise<typeof generatedContent.$inferSelect>;
}

export type VideoRouteOwnedContent = {
  id: number;
  prompt: string | null;
  generatedHook: string | null;
  generatedScript: string | null;
  voiceoverScript: string | null;
  sceneDescription: string | null;
  generatedMetadata: Record<string, unknown> | null;
};

export class ContentRepository implements IContentRepository {
  constructor(private readonly db: AppDb) {}

  async findIdAndHookForUser(
    contentId: number,
    userId: string,
  ): Promise<{ id: number; generatedHook: string | null } | null> {
    const [row] = await this.db
      .select({
        id: generatedContent.id,
        generatedHook: generatedContent.generatedHook,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async resolveContentAncestorChainIds(
    contentId: number,
    userId: string,
  ): Promise<number[]> {
    const ids: number[] = [];
    let currentId: number | null = contentId;
    let depth = 0;

    while (currentId != null && depth < MAX_CONTENT_CHAIN_DEPTH) {
      const [row] = await this.db
        .select({
          id: generatedContent.id,
          parentId: generatedContent.parentId,
        })
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, currentId),
            eq(generatedContent.userId, userId),
          ),
        )
        .limit(1);

      if (!row) break;
      ids.push(row.id);
      currentId = row.parentId;
      depth++;
    }

    return ids;
  }

  async listAssetsLinkedToGeneratedContent(
    generatedContentId: number,
  ): ReturnType<IContentRepository["listAssetsLinkedToGeneratedContent"]> {
    return this.db
      .select({
        assetId: contentAssets.assetId,
        role: contentAssets.role,
        id: assets.id,
        userId: assets.userId,
        type: assets.type,
        source: assets.source,
        name: assets.name,
        mimeType: assets.mimeType,
        r2Url: assets.r2Url,
        r2Key: assets.r2Key,
        sizeBytes: assets.sizeBytes,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
        createdAt: assets.createdAt,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(eq(contentAssets.generatedContentId, generatedContentId));
  }

  async findHookAndVoiceoverForUser(
    contentId: number,
    userId: string,
  ): Promise<{
    generatedHook: string | null;
    voiceoverScript: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        generatedHook: generatedContent.generatedHook,
        voiceoverScript: generatedContent.voiceoverScript,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async fetchOwnedContentForVideo(
    userId: string,
    generatedContentId: number,
  ): Promise<VideoRouteOwnedContent | null> {
    const [content] = await this.db
      .select({
        id: generatedContent.id,
        prompt: generatedContent.prompt,
        generatedHook: generatedContent.generatedHook,
        generatedScript: generatedContent.generatedScript,
        voiceoverScript: generatedContent.voiceoverScript,
        sceneDescription: generatedContent.sceneDescription,
        generatedMetadata: generatedContent.generatedMetadata,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, generatedContentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);

    if (!content) return null;
    return {
      ...content,
      generatedMetadata:
        (content.generatedMetadata as Record<string, unknown> | null) ?? null,
    };
  }

  async updatePhase4Metadata(input: {
    generatedContentId: number;
    existingGeneratedMetadata: Record<string, unknown> | null;
    jobId: string;
    status: "queued" | "running" | "completed" | "failed";
    shots?: Array<{
      shotIndex: number;
      description: string;
      durationMs: number;
      assetId: string;
      useClipAudio: boolean;
    }>;
    provider?: string;
  }): Promise<void> {
    const existingMetadata = input.existingGeneratedMetadata ?? {};
    const existingPhase4 =
      (existingMetadata.phase4 as Record<string, unknown> | null) ?? {};

    await this.db
      .update(generatedContent)
      .set({
        generatedMetadata: {
          ...existingMetadata,
          phase4: {
            ...existingPhase4,
            assembly: {
              ...((existingPhase4.assembly as Record<string, unknown> | null) ??
                {}),
              jobId: input.jobId,
              status: input.status,
              shots: input.shots,
              provider: input.provider,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      })
      .where(eq(generatedContent.id, input.generatedContentId));
  }

  async fetchOwnedAssetsForTimeline(
    userId: string,
    generatedContentId: number,
    assetIds: string[],
  ): Promise<{ id: string; type: string }[]> {
    if (assetIds.length === 0) return [];

    return this.db
      .select({
        id: assets.id,
        type: assets.type,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(
        and(
          eq(contentAssets.generatedContentId, generatedContentId),
          eq(assets.userId, userId),
          inArray(assets.id, assetIds),
        ),
      );
  }

  async listEditorAssetsForUser(
    userId: string,
    options: {
      contentId?: number;
      roles?: string[];
      excludeRoles?: string[];
    },
  ): ReturnType<IContentRepository["listEditorAssetsForUser"]> {
    // Subquery for user's content IDs
    const userContentIds = this.db
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(eq(generatedContent.userId, userId));

    const conditions: ReturnType<typeof eq>[] = [
      inArray(contentAssets.generatedContentId, userContentIds) as ReturnType<
        typeof eq
      >,
    ];

    if (options.contentId) {
      conditions.push(eq(contentAssets.generatedContentId, options.contentId));
    }

    if (options.roles && options.roles.length > 0) {
      conditions.push(
        inArray(contentAssets.role, options.roles) as ReturnType<typeof eq>,
      );
    } else if (options.excludeRoles && options.excludeRoles.length > 0) {
      conditions.push(
        notInArray(
          contentAssets.role,
          options.excludeRoles,
        ) as ReturnType<typeof eq>,
      );
    }

    return this.db
      .select({
        id: contentAssets.id,
        generatedContentId: contentAssets.generatedContentId,
        role: contentAssets.role,
        r2Url: assets.r2Url,
        durationMs: assets.durationMs,
        sourceHook: generatedContent.generatedHook,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .innerJoin(
        generatedContent,
        eq(contentAssets.generatedContentId, generatedContent.id),
      )
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt))
      .limit(100);
  }

  async listContentAssetsForUser(
    userId: string,
    generatedContentId: number,
    options: {
      typeFilter?: string;
    },
  ): ReturnType<IContentRepository["listContentAssetsForUser"]> {
    // Verify content belongs to user first
    const [content] = await this.db
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, generatedContentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);

    if (!content) return [];

    const conditions: ReturnType<typeof eq>[] = [
      eq(contentAssets.generatedContentId, generatedContentId),
    ];

    if (options.typeFilter) {
      conditions.push(eq(contentAssets.role, options.typeFilter));
    } else {
      // Editor / workspace source media only — not exported or legacy assembled outputs.
      conditions.push(
        notInArray(contentAssets.role, ["assembled_video", "final_video"]),
      );
      conditions.push(
        notInArray(assets.type, ["assembled_video", "final_video"]),
      );
    }

    return this.db
      .select({
        id: assets.id,
        userId: assets.userId,
        type: assets.type,
        source: assets.source,
        name: assets.name,
        mimeType: assets.mimeType,
        r2Key: assets.r2Key,
        r2Url: assets.r2Url,
        sizeBytes: assets.sizeBytes,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
        createdAt: assets.createdAt,
        role: contentAssets.role,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(and(...conditions));
  }

  async findChainTipDraftsForSession(
    userId: string,
    sessionId: string,
  ): ReturnType<IContentRepository["findChainTipDraftsForSession"]> {
    // Get all generatedContentIds from chatMessages for this session
    const messageRows = await this.db
      .select({ generatedContentId: chatMessages.generatedContentId })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.role, "assistant"),
          isNotNull(chatMessages.generatedContentId),
        ),
      );

    const contentIds = [
      ...new Set(
        messageRows
          .map((r) => r.generatedContentId)
          .filter((id): id is number => id != null),
      ),
    ];

    if (contentIds.length === 0) {
      return [];
    }

    // Fetch those generatedContent records with ownership check
    const records = await this.db
      .select({
        id: generatedContent.id,
        version: generatedContent.version,
        outputType: generatedContent.outputType,
        status: generatedContent.status,
        generatedHook: generatedContent.generatedHook,
        generatedScript: generatedContent.generatedScript,
        voiceoverScript: generatedContent.voiceoverScript,
        postCaption: generatedContent.postCaption,
        sceneDescription: generatedContent.sceneDescription,
        generatedMetadata: generatedContent.generatedMetadata,
        parentId: generatedContent.parentId,
        createdAt: generatedContent.createdAt,
      })
      .from(generatedContent)
      .where(
        and(
          inArray(generatedContent.id, contentIds),
          eq(generatedContent.userId, userId),
        ),
      );

    // Find tips: records that have no children anywhere in the table.
    const childRows = await this.db
      .select({ parentId: generatedContent.parentId })
      .from(generatedContent)
      .where(
        and(
          inArray(generatedContent.parentId, contentIds),
          eq(generatedContent.userId, userId),
        ),
      );

    const idsWithChildren = new Set(
      childRows
        .map((r) => r.parentId)
        .filter((id): id is number => id != null),
    );

    const tips = records
      .filter((r) => !idsWithChildren.has(r.id))
      .sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime(),
      )
      .map(({ parentId: _parentId, ...rest }) => rest);

    return tips;
  }

  async listGenerationHistory(
    userId: string,
    page: number,
    limit: number,
  ): ReturnType<IContentRepository["listGenerationHistory"]> {
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: generatedContent.id,
          type: generatedContent.outputType,
          prompt: generatedContent.prompt,
          createdAt: generatedContent.createdAt,
          sourceReelUsername: reels.username,
          sourceReelHook: reels.hook,
        })
        .from(generatedContent)
        .leftJoin(reels, eq(generatedContent.sourceReelId, reels.id))
        .where(eq(generatedContent.userId, userId))
        .orderBy(desc(generatedContent.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(generatedContent)
        .where(eq(generatedContent.userId, userId)),
    ]);

    const totalPages = Math.ceil(total / limit);

    return { rows, total, totalPages };
  }

  async listGeneratedContent(
    userId: string,
    limit: number,
    offset: number,
  ): ReturnType<IContentRepository["listGeneratedContent"]> {
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(generatedContent)
        .where(eq(generatedContent.userId, userId))
        .orderBy(desc(generatedContent.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(generatedContent)
        .where(eq(generatedContent.userId, userId)),
    ]);

    return { rows, total };
  }

  async findGeneratedContentById(
    id: number,
    userId: string,
  ): ReturnType<IContentRepository["findGeneratedContentById"]> {
    const [item] = await this.db
      .select()
      .from(generatedContent)
      .where(and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)))
      .limit(1);

    return item ?? null;
  }

  async updateGeneratedContentStatus(
    id: number,
    userId: string,
    status: string,
  ): ReturnType<IContentRepository["updateGeneratedContentStatus"]> {
    const [updated] = await this.db
      .update(generatedContent)
      .set({ status })
      .where(and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)))
      .returning();

    return updated ?? null;
  }

  async findOwnedGeneratedContentId(
    userId: string,
    generatedContentId: number,
  ): Promise<number | null> {
    const [row] = await this.db
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, generatedContentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async insertContentAssetLink(params: {
    generatedContentId: number;
    assetId: string;
    role: string;
  }) {
    await this.db.insert(contentAssets).values({
      generatedContentId: params.generatedContentId,
      assetId: params.assetId,
      role: params.role,
    });
  }

  async insertGeneratedVideoClipAndLink(params: {
    userId: string;
    generatedContentId: number;
    r2Key: string;
    r2Url: string;
    durationMs: number;
    shotIndex: number;
    provider: string;
    generationPrompt: string;
  }) {
    const [clipAsset] = await this.db
      .insert(assets)
      .values({
        userId: params.userId,
        type: "video_clip",
        source: "generated",
        r2Key: params.r2Key,
        r2Url: params.r2Url,
        durationMs: params.durationMs,
        metadata: {
          shotIndex: params.shotIndex,
          sourceType: "ai_generated",
          provider: params.provider,
          generationPrompt: params.generationPrompt,
          hasEmbeddedAudio: false,
          useClipAudio: false,
        },
      })
      .returning();
    if (!clipAsset) throw new Error("Failed to insert clip asset");
    await this.db.insert(contentAssets).values({
      generatedContentId: params.generatedContentId,
      assetId: clipAsset.id,
      role: "video_clip",
    });
    return { id: clipAsset.id };
  }

  async replaceGeneratedVideoClipForShot(params: {
    userId: string;
    generatedContentId: number;
    shotIndex: number;
    newClip: {
      r2Key: string;
      r2Url: string;
      durationMs: number;
      provider: string;
      generationPrompt: string;
    };
  }) {
    return this.db.transaction(async (tx) => {
      const allExistingClips = await tx
        .select({
          assetId: contentAssets.assetId,
          metadata: assets.metadata,
        })
        .from(contentAssets)
        .innerJoin(assets, eq(contentAssets.assetId, assets.id))
        .where(
          and(
            eq(contentAssets.generatedContentId, params.generatedContentId),
            eq(contentAssets.role, "video_clip"),
            eq(assets.userId, params.userId),
          ),
        );

      const staleIds = allExistingClips
        .filter(
          (a) =>
            Number((a.metadata as Record<string, unknown>)?.shotIndex ?? -1) ===
            params.shotIndex,
        )
        .map((a) => a.assetId);

      if (staleIds.length > 0) {
        await tx
          .delete(contentAssets)
          .where(
            and(
              eq(contentAssets.generatedContentId, params.generatedContentId),
              inArray(contentAssets.assetId, staleIds),
            ),
          );
        for (const assetId of staleIds) {
          try {
            await tx.delete(assets).where(eq(assets.id, assetId));
          } catch {
            /* best-effort, matches route behavior */
          }
        }
      }

      const [clipAsset] = await tx
        .insert(assets)
        .values({
          userId: params.userId,
          type: "video_clip",
          source: "generated",
          r2Key: params.newClip.r2Key,
          r2Url: params.newClip.r2Url,
          durationMs: params.newClip.durationMs,
          metadata: {
            shotIndex: params.shotIndex,
            sourceType: "ai_generated",
            provider: params.newClip.provider,
            generationPrompt: params.newClip.generationPrompt,
            hasEmbeddedAudio: false,
            useClipAudio: false,
          },
        })
        .returning();
      if (!clipAsset) throw new Error("Failed to insert clip asset");
      await tx.insert(contentAssets).values({
        generatedContentId: params.generatedContentId,
        assetId: clipAsset.id,
        role: "video_clip",
      });
      return { assetId: clipAsset.id };
    });
  }

  async listVideoClipAssetsForAiAssembly(
    userId: string,
    generatedContentId: number,
  ) {
    const rows = await this.db
      .select({
        id: assets.id,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(
        and(
          eq(contentAssets.generatedContentId, generatedContentId),
          eq(assets.userId, userId),
          eq(contentAssets.role, "video_clip"),
        ),
      );

    return rows.sort((a, b) => {
      const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
      const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
      return ai - bi;
    });
  }

  async fetchReelAndAnalysisForGeneration(reelId: number) {
    const [reel] = await this.db
      .select()
      .from(reels)
      .where(eq(reels.id, reelId));
    if (!reel) return null;
    const [analysis] = await this.db
      .select()
      .from(reelAnalyses)
      .where(eq(reelAnalyses.reelId, reelId));
    return { reel, analysis: analysis ?? null };
  }

  async createReelGeneratedDraftWithQueueEnrollment(params: {
    userId: string;
    reelId: number;
    prompt: string;
    outputType: string;
    generatedHook: string | null;
    postCaption: string | null;
    generatedScript: string | null;
    model: string;
  }): Promise<typeof generatedContent.$inferSelect> {
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(generatedContent)
        .values({
          userId: params.userId,
          sourceReelId: params.reelId,
          prompt: params.prompt,
          generatedHook: params.generatedHook,
          postCaption: params.postCaption,
          generatedScript: params.generatedScript,
          outputType: params.outputType,
          model: params.model,
          status: "draft",
        })
        .returning();

      if (!inserted) {
        throw new Error("Insert generated content returned no row");
      }

      await assertNoChainQueueItem(
        tx,
        inserted.id,
        params.userId,
        "reel_content_generator",
      );

      await tx.insert(queueItems).values({
        userId: params.userId,
        generatedContentId: inserted.id,
        status: "draft",
      });

      const [updated] = await tx
        .update(generatedContent)
        .set({ status: "queued" })
        .where(eq(generatedContent.id, inserted.id))
        .returning();

      return updated ?? inserted;
    });
  }
}
