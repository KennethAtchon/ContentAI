import { and, desc, eq } from "drizzle-orm";
import { assets } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export type AssetRow = typeof assets.$inferSelect;
export type NewUploadedAsset = typeof assets.$inferInsert;

export interface IAssetsRepository {
  listUploadedByUserId(userId: string): Promise<AssetRow[]>;

  insertUploaded(row: NewUploadedAsset): Promise<AssetRow>;

  findUploadedByUserAndId(
    userId: string,
    id: string,
  ): Promise<AssetRow | null>;

  deleteById(id: string): Promise<void>;
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
}
