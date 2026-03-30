import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import {
  assets,
  contentAssets,
  generatedContent,
  musicTracks,
  queueItems,
  reelAnalyses,
  reels,
} from "../../infrastructure/database/drizzle/schema";
import {
  assertNoChainQueueItem,
  findChainQueueItem,
} from "../../lib/queue-chain-guard";
import type { AppDb } from "../database.types";

/** Drizzle client for transactions and `resolveChainTip` / queue-chain helpers. */
export class ChatToolsRepository {
  constructor(private readonly database: AppDb) {}

  get client(): AppDb {
    return this.database;
  }

  async saveNewDraftContentWithQueueItem(params: {
    userId: string;
    prompt: string;
    hook: string;
    postCaption: string;
    script: string;
    voiceoverScript: string;
    sceneDescription: string;
    generatedMetadata: { hashtags: string[]; cta: string; contentType: string };
    outputType: "hook_only" | "caption_only" | "full_script";
  }): Promise<typeof generatedContent.$inferSelect> {
    return this.database.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(generatedContent)
        .values({
          userId: params.userId,
          prompt: params.prompt,
          generatedHook: params.hook,
          postCaption: params.postCaption,
          generatedScript: params.script,
          voiceoverScript: params.voiceoverScript,
          sceneDescription: params.sceneDescription,
          generatedMetadata: params.generatedMetadata,
          outputType: params.outputType,
          status: "draft",
          version: 1,
        })
        .returning();

      await assertNoChainQueueItem(
        tx,
        inserted.id,
        params.userId,
        "save_content",
      );
      await tx.insert(queueItems).values({
        userId: params.userId,
        generatedContentId: inserted.id,
        status: "draft",
      });

      return inserted;
    });
  }

  async findReelAnalysisForTool(reelId: number) {
    const [analysis] = await this.database
      .select({
        hookCategory: reelAnalyses.hookCategory,
        emotionalTrigger: reelAnalyses.emotionalTrigger,
        formatPattern: reelAnalyses.formatPattern,
        ctaType: reelAnalyses.ctaType,
        remixSuggestion: reelAnalyses.remixSuggestion,
        captionFramework: reelAnalyses.captionFramework,
        curiosityGapStyle: reelAnalyses.curiosityGapStyle,
        replicabilityScore: reelAnalyses.replicabilityScore,
        commentBaitStyle: reelAnalyses.commentBaitStyle,
        engagementDrivers: reelAnalyses.engagementDrivers,
      })
      .from(reelAnalyses)
      .where(eq(reelAnalyses.reelId, reelId))
      .limit(1);
    return analysis ?? null;
  }

  async findContentForGetTool(userId: string, contentId: number) {
    const [row] = await this.database
      .select({
        id: generatedContent.id,
        version: generatedContent.version,
        outputType: generatedContent.outputType,
        status: generatedContent.status,
        generatedHook: generatedContent.generatedHook,
        postCaption: generatedContent.postCaption,
        generatedScript: generatedContent.generatedScript,
        voiceoverScript: generatedContent.voiceoverScript,
        sceneDescription: generatedContent.sceneDescription,
        generatedMetadata: generatedContent.generatedMetadata,
        parentId: generatedContent.parentId,
        createdAt: generatedContent.createdAt,
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

  async findFullGeneratedContentForUser(userId: string, contentId: number) {
    const [row] = await this.database
      .select()
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

  async transactionEditContentNewVersion(params: {
    userId: string;
    prompt: string;
    tip: typeof generatedContent.$inferSelect;
    values: {
      generatedHook: string | null;
      postCaption: string | null;
      generatedScript: string | null;
      voiceoverScript: string | null;
      sceneDescription: string | null;
      generatedMetadata: Record<string, unknown>;
      outputType: string;
      version: number;
      parentId: number;
      sourceReelId: number | null;
    };
  }): Promise<typeof generatedContent.$inferSelect> {
    return this.database.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(generatedContent)
        .values({
          userId: params.userId,
          prompt: params.prompt,
          sourceReelId: params.values.sourceReelId,
          generatedHook: params.values.generatedHook,
          postCaption: params.values.postCaption,
          generatedScript: params.values.generatedScript,
          voiceoverScript: params.values.voiceoverScript,
          sceneDescription: params.values.sceneDescription,
          generatedMetadata: params.values.generatedMetadata,
          outputType: params.values.outputType,
          status: "draft",
          version: params.values.version,
          parentId: params.values.parentId,
        })
        .returning();

      const existing = await findChainQueueItem(
        tx,
        params.tip.id,
        params.userId,
      );
      if (existing) {
        await tx
          .update(queueItems)
          .set({ generatedContentId: inserted.id })
          .where(eq(queueItems.id, existing.queueItemId));
      } else {
        await assertNoChainQueueItem(
          tx,
          inserted.id,
          params.userId,
          "edit_content_field",
        );
        await tx.insert(queueItems).values({
          userId: params.userId,
          generatedContentId: inserted.id,
          status: "draft",
        });
      }

      return inserted;
    });
  }

  async transactionIterateContentNewVersion(params: {
    userId: string;
    prompt: string;
    effectiveParent: typeof generatedContent.$inferSelect;
    generatedMetadata: Record<string, unknown>;
  }): Promise<typeof generatedContent.$inferSelect> {
    const p = params.effectiveParent;
    return this.database.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(generatedContent)
        .values({
          userId: params.userId,
          prompt: params.prompt,
          sourceReelId: p.sourceReelId,
          generatedHook: p.generatedHook,
          postCaption: p.postCaption,
          generatedScript: p.generatedScript,
          voiceoverScript: p.voiceoverScript,
          sceneDescription: p.sceneDescription,
          generatedMetadata: params.generatedMetadata,
          outputType: p.outputType,
          status: "draft",
          version: p.version + 1,
          parentId: p.id,
        })
        .returning();

      const existing = await findChainQueueItem(tx, p.id, params.userId);
      if (existing) {
        await tx
          .update(queueItems)
          .set({ generatedContentId: inserted.id })
          .where(eq(queueItems.id, existing.queueItemId));
      } else {
        await assertNoChainQueueItem(
          tx,
          inserted.id,
          params.userId,
          "iterate_content",
        );
        await tx.insert(queueItems).values({
          userId: params.userId,
          generatedContentId: inserted.id,
          status: "draft",
        });
      }

      return inserted;
    });
  }

  async updateContentStatusForUser(
    userId: string,
    contentId: number,
    status: "draft" | "queued" | "archived",
  ): Promise<{ id: number } | null> {
    const [updated] = await this.database
      .update(generatedContent)
      .set({ status })
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .returning({ id: generatedContent.id });

    if (!updated) return null;

    if (status === "queued" || status === "draft") {
      await this.database
        .update(queueItems)
        .set({ status })
        .where(eq(queueItems.generatedContentId, contentId));
    }

    return updated;
  }

  async searchUserGeneratedContent(params: {
    userId: string;
    query?: string;
    status?: "draft" | "queued" | "processing" | "published" | "failed";
    limit: number;
  }) {
    const conditions = [eq(generatedContent.userId, params.userId)];

    if (params.status) {
      conditions.push(eq(generatedContent.status, params.status));
    }

    if (params.query) {
      conditions.push(
        or(
          ilike(generatedContent.generatedHook, `%${params.query}%`),
          ilike(generatedContent.postCaption, `%${params.query}%`),
        )!,
      );
    }

    return this.database
      .select({
        id: generatedContent.id,
        version: generatedContent.version,
        outputType: generatedContent.outputType,
        status: generatedContent.status,
        hook: generatedContent.generatedHook,
        postCaption: generatedContent.postCaption,
        createdAt: generatedContent.createdAt,
      })
      .from(generatedContent)
      .where(and(...conditions))
      .orderBy(desc(generatedContent.createdAt))
      .limit(params.limit);
  }

  async findContentVoiceoverSource(userId: string, contentId: number) {
    const [content] = await this.database
      .select({
        id: generatedContent.id,
        voiceoverScript: generatedContent.voiceoverScript,
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
    return content ?? null;
  }

  /** Existing voiceover link + R2 key for replace flow (matches prior chat-tools behavior). */
  async getVoiceoverAttachmentForContent(contentId: number) {
    const [existingLink] = await this.database
      .select({ assetId: contentAssets.assetId })
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "voiceover"),
        ),
      )
      .limit(1);
    if (!existingLink) return null;
    const [existingAsset] = await this.database
      .select({ r2Key: assets.r2Key })
      .from(assets)
      .where(eq(assets.id, existingLink.assetId))
      .limit(1);
    return {
      assetId: existingLink.assetId,
      r2Key: existingAsset?.r2Key ?? null,
    };
  }

  async deleteVoiceoverLinksForContent(contentId: number) {
    await this.database
      .delete(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "voiceover"),
        ),
      );
  }

  async deleteAssetById(assetId: string) {
    await this.database.delete(assets).where(eq(assets.id, assetId));
  }

  async insertVoiceoverAsset(params: {
    userId: string;
    r2Key: string;
    r2Url: string;
    durationMs: number;
    metadata: { voiceId: string; speed: string };
  }) {
    const [asset] = await this.database
      .insert(assets)
      .values({
        userId: params.userId,
        type: "voiceover",
        source: "tts",
        r2Key: params.r2Key,
        r2Url: params.r2Url,
        durationMs: params.durationMs,
        metadata: params.metadata,
      })
      .returning({ id: assets.id });
    return asset!;
  }

  async linkVoiceoverAsset(contentId: number, assetId: string) {
    await this.database.insert(contentAssets).values({
      generatedContentId: contentId,
      assetId,
      role: "voiceover",
    });
  }

  async searchActiveMusicTracks(params: {
    mood?: "energetic" | "calm" | "dramatic" | "funny" | "inspiring";
    search?: string;
    limit: number;
  }) {
    const conditions: ReturnType<typeof eq>[] = [eq(musicTracks.isActive, true)];
    if (params.mood) conditions.push(eq(musicTracks.mood, params.mood));
    if (params.search) {
      conditions.push(
        or(
          ilike(musicTracks.name, `%${params.search}%`),
          ilike(musicTracks.artistName, `%${params.search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    return this.database
      .select({
        id: musicTracks.id,
        name: musicTracks.name,
        artistName: musicTracks.artistName,
        durationSeconds: musicTracks.durationSeconds,
        mood: musicTracks.mood,
        genre: musicTracks.genre,
      })
      .from(musicTracks)
      .where(and(...conditions))
      .orderBy(desc(musicTracks.createdAt))
      .limit(params.limit);
  }

  async findOwnedContentId(userId: string, contentId: number) {
    const [content] = await this.database
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return content ?? null;
  }

  async findActiveMusicTrackById(musicTrackId: string) {
    const [track] = await this.database
      .select({
        id: musicTracks.id,
        name: musicTracks.name,
        artistName: musicTracks.artistName,
        assetId: musicTracks.assetId,
      })
      .from(musicTracks)
      .where(
        and(eq(musicTracks.id, musicTrackId), eq(musicTracks.isActive, true)),
      )
      .limit(1);
    return track ?? null;
  }

  async deleteBackgroundMusicLinks(contentId: number) {
    await this.database
      .delete(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "background_music"),
        ),
      );
  }

  async insertBackgroundMusicLink(contentId: number, assetId: string) {
    await this.database.insert(contentAssets).values({
      generatedContentId: contentId,
      assetId,
      role: "background_music",
    });
  }

  async findContentForVideoPrompt(userId: string, contentId: number) {
    const [content] = await this.database
      .select({
        id: generatedContent.id,
        generatedHook: generatedContent.generatedHook,
        prompt: generatedContent.prompt,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return content ?? null;
  }

  async findContentIdOnly(userId: string, contentId: number) {
    const [content] = await this.database
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return content ?? null;
  }

  async findVoiceoverLinkWithR2(userId: string, contentId: number) {
    const [link] = await this.database
      .select({ assetId: contentAssets.assetId, r2Key: assets.r2Key })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "voiceover"),
          eq(assets.userId, userId),
        ),
      )
      .limit(1);
    return link ?? null;
  }

  async deleteVoiceoverLinkAndAsset(contentId: number, assetId: string) {
    await this.database
      .delete(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "voiceover"),
        ),
      );
    await this.database
      .delete(assets)
      .where(eq(assets.id, assetId))
      .catch(() => {});
  }

  async findBackgroundMusicLink(contentId: number) {
    const [link] = await this.database
      .select({ assetId: contentAssets.assetId })
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "background_music"),
        ),
      )
      .limit(1);
    return link ?? null;
  }

  async deleteBackgroundMusicLinkOnly(contentId: number) {
    await this.database
      .delete(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, contentId),
          eq(contentAssets.role, "background_music"),
        ),
      );
  }

  async findQueueItemForUserContent(userId: string, contentId: number) {
    const [item] = await this.database
      .select({ id: queueItems.id })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.generatedContentId, contentId),
          eq(queueItems.userId, userId),
        ),
      )
      .limit(1);
    return item ?? null;
  }

  async deleteQueueItemById(queueItemId: number) {
    await this.database.delete(queueItems).where(eq(queueItems.id, queueItemId));
  }

  async findQueueItemForSchedule(userId: string, contentId: number) {
    const [item] = await this.database
      .select({ id: queueItems.id, status: queueItems.status })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.generatedContentId, contentId),
          eq(queueItems.userId, userId),
        ),
      )
      .limit(1);
    return item ?? null;
  }

  async updateQueueItemSchedule(
    queueItemId: number,
    updateData: Record<string, unknown>,
  ) {
    await this.database
      .update(queueItems)
      .set(updateData)
      .where(eq(queueItems.id, queueItemId));
  }

  async aggregateTrendingAudio(days: number, limit: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.database
      .select({
        audioName: reels.audioName,
        useCount: sql<number>`count(*)::int`,
      })
      .from(reels)
      .where(and(isNotNull(reels.audioName), gte(reels.scrapedAt, cutoff)))
      .groupBy(reels.audioName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
  }

  async insertGeneratedImageAsset(params: {
    id: string;
    userId: string;
    name: string;
    r2Key: string;
    r2Url: string;
    sizeBytes: number;
    metadata: Record<string, unknown>;
  }) {
    const [item] = await this.database
      .insert(assets)
      .values({
        id: params.id,
        userId: params.userId,
        name: params.name,
        type: "image",
        source: "generated",
        mimeType: "image/png",
        r2Key: params.r2Key,
        r2Url: params.r2Url,
        sizeBytes: params.sizeBytes,
        durationMs: null,
        metadata: params.metadata,
      })
      .returning();
    return item!;
  }
}

/** DB port for AI chat tools (instance shape of {@link ChatToolsRepository}). */
export type IChatToolsRepository = ChatToolsRepository;
