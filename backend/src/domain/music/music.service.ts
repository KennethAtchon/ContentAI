import { getFileUrl } from "../../services/storage/r2";
import { Errors } from "../../utils/errors/app-error";
import type { IMusicRepository } from "./music.repository";

export class MusicService {
  constructor(private readonly music: IMusicRepository) {}

  async listLibrary(
    query: {
      search?: string;
      mood?: string;
      durationBucket?: string;
      page: number;
      limit: number;
    },
  ) {
    const offset = (query.page - 1) * query.limit;
    const { tracks, total } = await this.music.listMusicLibraryPage({
      search: query.search,
      mood: query.mood,
      durationBucket: query.durationBucket,
      limit: query.limit,
      offset,
    });

    const tracksWithUrls = await Promise.all(
      tracks.map(async (track) => {
        let previewUrl = "";
        try {
          previewUrl = await getFileUrl(track.r2Key, 3600);
        } catch {
          /* presign failed — still return row */
        }
        return {
          id: track.id,
          name: track.name,
          artistName: track.artistName,
          durationSeconds: track.durationSeconds,
          mood: track.mood,
          genre: track.genre,
          previewUrl,
          isSystemTrack: true as const,
        };
      }),
    );

    return {
      tracks: tracksWithUrls,
      total,
      page: query.page,
      hasMore: offset + tracks.length < total,
    };
  }

  async attachMusicToContent(
    userId: string,
    generatedContentId: number,
    musicTrackId: string,
  ) {
    const content = await this.music.findGeneratedContentForUser(
      generatedContentId,
      userId,
    );
    if (!content) throw Errors.notFound("Content");

    const track = await this.music.findActiveMusicTrackWithAsset(musicTrackId);
    if (!track) throw Errors.notFound("Music track");

    await this.music.replaceBackgroundMusicForContent(
      generatedContentId,
      track.assetId,
    );

    return {
      asset: {
        assetId: track.assetId,
        role: "background_music" as const,
        trackName: track.name,
        artistName: track.artistName,
        mood: track.mood,
        durationMs: track.durationSeconds * 1000,
      },
    };
  }
}
