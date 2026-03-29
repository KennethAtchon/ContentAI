import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AppDb } from "../database.types";
import {
  assets,
  contentAssets,
  generatedContent,
  reels,
  trendingAudio,
} from "../../infrastructure/database/drizzle/schema";
import type { AssetRow } from "../assets/assets.repository";

export type TrendingAudioQuery = {
  days: number;
  limit: number;
  nicheId?: number;
};

export type TrendingAudioRawRow = {
  audioId: string | null;
  audioName: string | null;
  artistName: string | null;
  useCount: number | null;
  prevCount: number | null;
  lastSeen: string | null;
};

export interface IAudioRepository {
  listTrendingAudio(query: TrendingAudioQuery): Promise<TrendingAudioRawRow[]>;
  findGeneratedContentForUser(
    contentId: number,
    userId: string,
  ): Promise<{ id: number } | null>;
  findVoiceoverAssetForContent(
    generatedContentId: number,
  ): Promise<AssetRow | null>;
  deleteVoiceoverLinkAndAsset(
    generatedContentId: number,
    assetId: string,
  ): Promise<void>;
  insertVoiceoverContentLink(
    generatedContentId: number,
    assetId: string,
  ): Promise<void>;
}

export class AudioRepository implements IAudioRepository {
  constructor(private readonly db: AppDb) {}

  async listTrendingAudio(
    query: TrendingAudioQuery,
  ): Promise<TrendingAudioRawRow[]> {
    const { days, limit, nicheId } = query;
    const startWindow = sql.raw(`NOW() - INTERVAL '${days} days'`);
    const prevWindow = sql.raw(`NOW() - INTERVAL '${days * 2} days'`);

    const conditions = [
      sql`${reels.audioId} is not null`,
      sql`${reels.audioName} is not null`,
      gte(reels.scrapedAt, prevWindow),
    ];

    if (nicheId !== undefined) {
      conditions.push(eq(reels.nicheId, nicheId));
    }

    return this.db
      .select({
        audioId: reels.audioId,
        audioName: reels.audioName,
        artistName: trendingAudio.artistName,
        useCount:
          sql<number>`sum(case when ${reels.scrapedAt} >= ${startWindow} then 1 else 0 end)::int`,
        prevCount:
          sql<number>`sum(case when ${reels.scrapedAt} < ${startWindow} then 1 else 0 end)::int`,
        lastSeen: sql<string>`max(${reels.scrapedAt})::text`,
      })
      .from(reels)
      .leftJoin(trendingAudio, eq(trendingAudio.audioId, reels.audioId))
      .where(and(...conditions))
      .groupBy(reels.audioId, reels.audioName, trendingAudio.artistName)
      .orderBy(
        desc(
          sql`sum(case when ${reels.scrapedAt} >= ${startWindow} then 1 else 0 end)`,
        ),
      )
      .limit(limit);
  }

  async findGeneratedContentForUser(
    contentId: number,
    userId: string,
  ): Promise<{ id: number } | null> {
    const [row] = await this.db
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      );
    return row ?? null;
  }

  async findVoiceoverAssetForContent(
    generatedContentId: number,
  ): Promise<AssetRow | null> {
    const [row] = await this.db
      .select({ asset: assets })
      .from(contentAssets)
      .innerJoin(assets, eq(assets.id, contentAssets.assetId))
      .where(
        and(
          eq(contentAssets.generatedContentId, generatedContentId),
          eq(contentAssets.role, "voiceover"),
        ),
      )
      .limit(1);
    return row?.asset ?? null;
  }

  async deleteVoiceoverLinkAndAsset(
    generatedContentId: number,
    assetId: string,
  ): Promise<void> {
    await this.db
      .delete(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, generatedContentId),
          eq(contentAssets.role, "voiceover"),
        ),
      );
    await this.db.delete(assets).where(eq(assets.id, assetId));
  }

  async insertVoiceoverContentLink(
    generatedContentId: number,
    assetId: string,
  ): Promise<void> {
    await this.db.insert(contentAssets).values({
      generatedContentId,
      assetId,
      role: "voiceover",
    });
  }
}
