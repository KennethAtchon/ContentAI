import { and, desc, eq, inArray } from "drizzle-orm";
import { assets } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export type AssetRow = typeof assets.$inferSelect;
export type NewUploadedAsset = typeof assets.$inferInsert;
export type NewAssetRow = typeof assets.$inferInsert;

export interface IAssetsRepository {
  listUploadedByUserId(userId: string): Promise<AssetRow[]>;

  insertUploaded(row: NewUploadedAsset): Promise<AssetRow>;

  findUploadedByUserAndId(
    userId: string,
    id: string,
  ): Promise<AssetRow | null>;

  deleteById(id: string): Promise<void>;

  /** R2 fields for an asset owned by the user (e.g. export output). */
  findR2FieldsByIdForUser(
    userId: string,
    assetId: string,
  ): Promise<{ r2Key: string | null; r2Url: string | null } | null>;

  findR2KeyByIdAndUserId(
    assetId: string,
    userId: string,
  ): Promise<{ r2Key: string | null; mimeType: string | null } | null>;

  findByIdForUser(assetId: string, userId: string): Promise<AssetRow | null>;

  findManyByIdsForUser(userId: string, ids: string[]): Promise<AssetRow[]>;

  insertAsset(row: NewAssetRow): Promise<AssetRow>;

  updateMetadata(
    assetId: string,
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<AssetRow | null>;
}

export class AssetsRepository implements IAssetsRepository {
  constructor(private readonly db: AppDb) {}

  async listUploadedByUserId(userId: string): Promise<AssetRow[]> {
    return this.db
      .select()
      .from(assets)
      .where(and(eq(assets.userId, userId), eq(assets.source, "uploaded")))
      .orderBy(desc(assets.createdAt));
  }

  async insertUploaded(row: NewUploadedAsset): Promise<AssetRow> {
    const [created] = await this.db.insert(assets).values(row).returning();
    if (!created) {
      throw new Error("Failed to insert asset");
    }
    return created;
  }

  async findUploadedByUserAndId(
    userId: string,
    id: string,
  ): Promise<AssetRow | null> {
    const [row] = await this.db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.id, id),
          eq(assets.userId, userId),
          eq(assets.source, "uploaded"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(assets).where(eq(assets.id, id));
  }

  async findR2FieldsByIdForUser(userId: string, assetId: string) {
    const [row] = await this.db
      .select({ r2Key: assets.r2Key, r2Url: assets.r2Url })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async findByIdForUser(
    assetId: string,
    userId: string,
  ): Promise<AssetRow | null> {
    const [row] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async findManyByIdsForUser(
    userId: string,
    ids: string[],
  ): Promise<AssetRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(assets)
      .where(and(inArray(assets.id, ids), eq(assets.userId, userId)));
  }

  async insertAsset(row: NewAssetRow): Promise<AssetRow> {
    const [created] = await this.db.insert(assets).values(row).returning();
    if (!created) throw new Error("Failed to insert asset");
    return created;
  }

  async updateMetadata(
    assetId: string,
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<AssetRow | null> {
    const [existing] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
      .limit(1);

    if (!existing) return null;

    const [updated] = await this.db
      .update(assets)
      .set({
        metadata: {
          ...((existing.metadata as Record<string, unknown>) ?? {}),
          ...metadata,
        },
      })
      .where(eq(assets.id, assetId))
      .returning();

    return updated ?? null;
  }

  async findR2KeyByIdAndUserId(
    assetId: string,
    userId: string,
  ): Promise<{ r2Key: string | null; mimeType: string | null } | null> {
    const [asset] = await this.db
      .select({
        r2Key: assets.r2Key,
        mimeType: assets.mimeType,
      })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
      .limit(1);
    return asset ?? null;
  }
}
