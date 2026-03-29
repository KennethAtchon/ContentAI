import { and, eq } from "drizzle-orm";
import {
  assets,
  contentAssets,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export type GeneratedContentRow = typeof generatedContent.$inferSelect;

export interface ContentAssetJoinRow {
  id: string;
  role: string | null;
  durationMs: number | null;
  metadata: unknown;
}

export interface IContentRepository {
  findIdAndHookForUser(
    generatedContentId: number,
    userId: string,
  ): Promise<{ id: number; generatedHook: string | null } | null>;

  listAssetsLinkedToGeneratedContent(
    generatedContentId: number,
  ): Promise<ContentAssetJoinRow[]>;
}

export class ContentRepository implements IContentRepository {
  constructor(private readonly db: AppDb) {}

  async findIdAndHookForUser(
    generatedContentId: number,
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
          eq(generatedContent.id, generatedContentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listAssetsLinkedToGeneratedContent(
    generatedContentId: number,
  ): Promise<ContentAssetJoinRow[]> {
    return this.db
      .select({
        id: assets.id,
        role: contentAssets.role,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(eq(contentAssets.generatedContentId, generatedContentId));
  }
}
