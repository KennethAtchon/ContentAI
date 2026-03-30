import { eq, sql } from "drizzle-orm";
import type { AppDb } from "../database.types";
import {
  reelAnalyses,
  reels,
  trendingAudio,
  type NewReel,
} from "../../infrastructure/database/drizzle/schema";

export type ReelR2Updates = {
  videoR2Url?: string;
  audioR2Url?: string;
  thumbnailR2Url?: string;
};

export interface IScrapingRepository {
  insertScrapedReelOrSkip(row: NewReel): Promise<{ id: number } | null>;
  bumpTrendingAudioUsage(audioId: string, audioName: string): Promise<void>;
  countReelsInNiche(nicheId: number): Promise<number>;
  reelAnalysisExists(reelId: number): Promise<boolean>;
  updateReelR2Fields(reelId: number, updates: ReelR2Updates): Promise<void>;
}

export class ScrapingRepository implements IScrapingRepository {
  constructor(private readonly db: AppDb) {}

  async insertScrapedReelOrSkip(row: NewReel): Promise<{ id: number } | null> {
    const result = await this.db
      .insert(reels)
      .values(row)
      .onConflictDoNothing({ target: reels.externalId })
      .returning({ id: reels.id });

    const first = result[0];
    return first ? { id: first.id } : null;
  }

  async bumpTrendingAudioUsage(
    audioId: string,
    audioName: string,
  ): Promise<void> {
    await this.db
      .insert(trendingAudio)
      .values({
        audioId,
        audioName,
        artistName: null,
        useCount: 1,
        lastSeen: new Date(),
      })
      .onConflictDoUpdate({
        target: trendingAudio.audioId,
        set: {
          useCount: sql`${trendingAudio.useCount} + 1`,
          lastSeen: new Date(),
        },
      });
  }

  async countReelsInNiche(nicheId: number): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(reels)
      .where(eq(reels.nicheId, nicheId));
    return total;
  }

  async reelAnalysisExists(reelId: number): Promise<boolean> {
    const [existing] = await this.db
      .select({ id: reelAnalyses.id })
      .from(reelAnalyses)
      .where(eq(reelAnalyses.reelId, reelId));
    return Boolean(existing);
  }

  async updateReelR2Fields(
    reelId: number,
    updates: ReelR2Updates,
  ): Promise<void> {
    if (Object.keys(updates).length === 0) return;
    await this.db.update(reels).set(updates).where(eq(reels.id, reelId));
  }
}
