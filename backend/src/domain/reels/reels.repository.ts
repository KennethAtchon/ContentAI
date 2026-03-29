import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "../database.types";
import {
  featureUsages,
  generatedContent,
  niches,
  queueItems,
  reelAnalyses,
  reels,
  type Reel,
} from "../../infrastructure/database/drizzle/schema";

export type ReelSort = "views" | "fresh" | "engagement" | "recent";

export type ReelListRow = {
  id: number;
  username: string;
  nicheId: number | null;
  views: number;
  likes: number;
  comments: number;
  engagementRate: string | null;
  hook: string | null;
  thumbnailEmoji: string | null;
  thumbnailR2Url: string | null;
  videoR2Url: string | null;
  daysAgo: number | null;
  isViral: boolean | null;
  audioName: string | null;
  createdAt: Date;
};

export interface IReelsRepository {
  getUserReelsUsageCounts(userId: string): Promise<{
    reelAnalysisCount: number;
    contentGeneratedCount: number;
    scheduledQueueCount: number;
  }>;
  listActiveNiches(): Promise<Array<{ id: number; name: string }>>;
  findNicheIdByNameIlike(fragment: string): Promise<number | null>;
  listReelsPage(input: {
    nicheId?: number;
    nicheNameSearch: string;
    limit: number;
    offset: number;
    minViews?: number;
    sort: ReelSort;
    search?: string;
  }): Promise<{ rows: ReelListRow[]; total: number }>;
  findAnalyzedReelIds(reelIds: number[]): Promise<number[]>;
  findReelsByIds(ids: number[]): Promise<Reel[]>;
  findReelById(id: number): Promise<Reel | null>;
  findAnalysisByReelId(reelId: number): Promise<
    typeof reelAnalyses.$inferSelect | null
  >;
  findVideoR2UrlForReel(
    id: number,
  ): Promise<{ videoR2Url: string | null } | null>;
  findViralReelsForNiche(
    nicheId: number,
    minViews: number,
  ): Promise<Reel[]>;
  findAnalysesForReelIds(
    reelIds: number[],
  ): Promise<(typeof reelAnalyses.$inferSelect)[]>;
}

export class ReelsRepository implements IReelsRepository {
  constructor(private readonly db: AppDb) {}

  async getUserReelsUsageCounts(userId: string): Promise<{
    reelAnalysisCount: number;
    contentGeneratedCount: number;
    scheduledQueueCount: number;
  }> {
    const [reelsAnalyzedCount, contentGeneratedCount, queueSizeCount] =
      await Promise.all([
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(featureUsages)
          .where(
            and(
              eq(featureUsages.userId, userId),
              eq(featureUsages.featureType, "reel_analysis"),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(generatedContent)
          .where(eq(generatedContent.userId, userId)),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(queueItems)
          .where(
            and(
              eq(queueItems.userId, userId),
              eq(queueItems.status, "scheduled"),
            ),
          ),
      ]);

    return {
      reelAnalysisCount: reelsAnalyzedCount[0]?.count ?? 0,
      contentGeneratedCount: contentGeneratedCount[0]?.count ?? 0,
      scheduledQueueCount: queueSizeCount[0]?.count ?? 0,
    };
  }

  async listActiveNiches(): Promise<Array<{ id: number; name: string }>> {
    return this.db
      .select({ id: niches.id, name: niches.name })
      .from(niches)
      .where(eq(niches.isActive, true))
      .orderBy(niches.name);
  }

  async findNicheIdByNameIlike(fragment: string): Promise<number | null> {
    const [matched] = await this.db
      .select({ id: niches.id })
      .from(niches)
      .where(ilike(niches.name, `%${fragment}%`))
      .limit(1);
    return matched?.id ?? null;
  }

  async listReelsPage(input: {
    nicheId?: number;
    nicheNameSearch: string;
    limit: number;
    offset: number;
    minViews?: number;
    sort: ReelSort;
    search?: string;
  }): Promise<{ rows: ReelListRow[]; total: number }> {
    const {
      nicheId,
      nicheNameSearch,
      limit,
      offset,
      minViews,
      sort,
      search,
    } = input;

    const nicheIdParam = nicheId ? String(nicheId) : undefined;
    const isTrending =
      nicheNameSearch.toLowerCase() === "trending" ||
      nicheIdParam === "trending";

    const orderBy =
      sort === "fresh"
        ? [desc(sql`DATE(${reels.scrapedAt})`), desc(reels.views)]
        : sort === "engagement"
          ? [desc(reels.engagementRate)]
          : sort === "recent"
            ? [desc(reels.createdAt)]
            : [desc(reels.views)];

    const conditions: SQL[] = [];
    if (minViews !== undefined) conditions.push(gte(reels.views, minViews));
    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(ilike(reels.username, term), ilike(reels.hook, term))!,
      );
    }

    if (isTrending) {
      conditions.push(gte(reels.scrapedAt, sql`NOW() - INTERVAL '7 days'`));
    } else if (nicheId !== undefined) {
      conditions.push(eq(reels.nicheId, nicheId));
    } else if (nicheNameSearch) {
      const matchedId = await this.findNicheIdByNameIlike(nicheNameSearch);
      if (matchedId !== null) conditions.push(eq(reels.nicheId, matchedId));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const listBase = this.db
      .select({
        id: reels.id,
        username: reels.username,
        nicheId: reels.nicheId,
        views: reels.views,
        likes: reels.likes,
        comments: reels.comments,
        engagementRate: reels.engagementRate,
        hook: reels.hook,
        thumbnailEmoji: reels.thumbnailEmoji,
        thumbnailR2Url: reels.thumbnailR2Url,
        videoR2Url: reels.videoR2Url,
        daysAgo: reels.daysAgo,
        isViral: reels.isViral,
        audioName: reels.audioName,
        createdAt: reels.createdAt,
      })
      .from(reels);

    const [reelRows, countRows] = await Promise.all([
      whereClause
        ? listBase
            .where(whereClause)
            .orderBy(...orderBy)
            .limit(limit)
            .offset(offset)
        : listBase.orderBy(...orderBy).limit(limit).offset(offset),
      whereClause
        ? this.db
            .select({ total: sql<number>`count(*)::int` })
            .from(reels)
            .where(whereClause)
        : this.db.select({ total: sql<number>`count(*)::int` }).from(reels),
    ]);

    const total = countRows[0]?.total ?? 0;
    return { rows: reelRows as ReelListRow[], total };
  }

  async findAnalyzedReelIds(reelIds: number[]): Promise<number[]> {
    if (reelIds.length === 0) return [];
    const analysisRows = await this.db
      .select({ reelId: reelAnalyses.reelId })
      .from(reelAnalyses)
      .where(inArray(reelAnalyses.reelId, reelIds));
    return analysisRows.map((a) => a.reelId);
  }

  async findReelsByIds(ids: number[]): Promise<Reel[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(reels).where(inArray(reels.id, ids));
  }

  async findReelById(id: number): Promise<Reel | null> {
    const [reel] = await this.db.select().from(reels).where(eq(reels.id, id));
    return reel ?? null;
  }

  async findAnalysisByReelId(
    reelId: number,
  ): Promise<typeof reelAnalyses.$inferSelect | null> {
    const [analysis] = await this.db
      .select()
      .from(reelAnalyses)
      .where(eq(reelAnalyses.reelId, reelId));
    return analysis ?? null;
  }

  async findVideoR2UrlForReel(
    id: number,
  ): Promise<{ videoR2Url: string | null } | null> {
    const [reel] = await this.db
      .select({ videoR2Url: reels.videoR2Url })
      .from(reels)
      .where(eq(reels.id, id));
    return reel ?? null;
  }

  async findViralReelsForNiche(
    nicheId: number,
    minViews: number,
  ): Promise<Reel[]> {
    return this.db
      .select()
      .from(reels)
      .where(and(gte(reels.views, minViews), eq(reels.nicheId, nicheId)))
      .orderBy(desc(reels.views));
  }

  async findAnalysesForReelIds(
    reelIds: number[],
  ): Promise<(typeof reelAnalyses.$inferSelect)[]> {
    if (reelIds.length === 0) return [];
    return this.db
      .select()
      .from(reelAnalyses)
      .where(inArray(reelAnalyses.reelId, reelIds));
  }
}
