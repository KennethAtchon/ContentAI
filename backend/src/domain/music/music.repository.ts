import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { AppDb } from "../database.types";
import {
  assets,
  contentAssets,
  generatedContent,
  musicTracks,
} from "../../infrastructure/database/drizzle/schema";

export type MusicLibraryListFilter = {
  search?: string;
  mood?: string;
  durationBucket?: string;
  limit: number;
  offset: number;
};

export type MusicLibraryTrackRow = {
  id: string;
  name: string;
  artistName: string | null;
  durationSeconds: number;
  mood: string;
  genre: string | null;
  createdAt: Date;
  r2Key: string;
};

export type MusicTrackAttachRow = {
  id: string;
  name: string;
  artistName: string | null;
  mood: string;
  assetId: string;
  r2Key: string;
  durationSeconds: number;
};

export interface IMusicRepository {
  listMusicLibraryPage(
    filter: MusicLibraryListFilter,
  ): Promise<{ tracks: MusicLibraryTrackRow[]; total: number }>;
  findGeneratedContentForUser(
    contentId: number,
    userId: string,
  ): Promise<{ id: number } | null>;
  findActiveMusicTrackWithAsset(
    trackId: string,
  ): Promise<MusicTrackAttachRow | null>;
  replaceBackgroundMusicForContent(
    generatedContentId: number,
    assetId: string,
  ): Promise<void>;
}

export class MusicRepository implements IMusicRepository {
  constructor(private readonly db: AppDb) {}

  private libraryWhereClause(
    filter: Omit<MusicLibraryListFilter, "limit" | "offset">,
  ) {
    const conditions = [eq(musicTracks.isActive, true)];

    if (filter.search) {
      const term = `%${filter.search}%`;
      conditions.push(
        or(ilike(musicTracks.name, term), ilike(musicTracks.artistName, term))!,
      );
    }

    if (filter.mood) {
      conditions.push(eq(musicTracks.mood, filter.mood));
    }

    if (filter.durationBucket === "15") {
      conditions.push(lte(musicTracks.durationSeconds, 20));
    } else if (filter.durationBucket === "30") {
      conditions.push(
        and(
          gte(musicTracks.durationSeconds, 21),
          lte(musicTracks.durationSeconds, 45),
        )!,
      );
    } else if (filter.durationBucket === "60") {
      conditions.push(
        and(
          gte(musicTracks.durationSeconds, 46),
          lte(musicTracks.durationSeconds, 90),
        )!,
      );
    }

    return and(...conditions);
  }

  async listMusicLibraryPage(
    filter: MusicLibraryListFilter,
  ): Promise<{ tracks: MusicLibraryTrackRow[]; total: number }> {
    const { limit, offset, ...rest } = filter;
    const whereClause = this.libraryWhereClause(rest);

    const [trackRows, [countRow]] = await Promise.all([
      this.db
        .select({
          id: musicTracks.id,
          name: musicTracks.name,
          artistName: musicTracks.artistName,
          durationSeconds: musicTracks.durationSeconds,
          mood: musicTracks.mood,
          genre: musicTracks.genre,
          createdAt: musicTracks.createdAt,
          r2Key: assets.r2Key,
        })
        .from(musicTracks)
        .innerJoin(assets, eq(musicTracks.assetId, assets.id))
        .where(whereClause)
        .orderBy(desc(musicTracks.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(musicTracks)
        .where(whereClause),
    ]);

    const total = countRow?.count ?? 0;
    return { tracks: trackRows, total };
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

  async findActiveMusicTrackWithAsset(
    trackId: string,
  ): Promise<MusicTrackAttachRow | null> {
    const [row] = await this.db
      .select({
        id: musicTracks.id,
        name: musicTracks.name,
        artistName: musicTracks.artistName,
        mood: musicTracks.mood,
        assetId: musicTracks.assetId,
        r2Key: assets.r2Key,
        durationSeconds: musicTracks.durationSeconds,
      })
      .from(musicTracks)
      .innerJoin(assets, eq(musicTracks.assetId, assets.id))
      .where(and(eq(musicTracks.id, trackId), eq(musicTracks.isActive, true)))
      .limit(1);
    return row ?? null;
  }

  async replaceBackgroundMusicForContent(
    generatedContentId: number,
    assetId: string,
  ): Promise<void> {
    await this.db
      .delete(contentAssets)
      .where(
        and(
          eq(contentAssets.generatedContentId, generatedContentId),
          eq(contentAssets.role, "background_music"),
        ),
      );

    await this.db.insert(contentAssets).values({
      generatedContentId,
      assetId,
      role: "background_music",
    });
  }
}
