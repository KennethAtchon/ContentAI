import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  assets,
  contentAssets,
  generatedContent,
  reels,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IContentRepository {
  findIdAndHookForUser(
    contentId: number,
    userId: string,
  ): Promise<{ id: number; generatedHook: string | null } | null>;

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
}
