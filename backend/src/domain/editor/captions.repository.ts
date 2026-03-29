import { and, eq } from "drizzle-orm";
import {
  captions,
  type NewCaption,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export type CaptionRow = typeof captions.$inferSelect;

export interface ICaptionsRepository {
  findByAssetAndUser(
    assetId: string,
    userId: string,
  ): Promise<CaptionRow | null>;

  insert(row: NewCaption): Promise<CaptionRow>;
}

export class CaptionsRepository implements ICaptionsRepository {
  constructor(private readonly db: AppDb) {}

  async findByAssetAndUser(
    assetId: string,
    userId: string,
  ): Promise<CaptionRow | null> {
    const [row] = await this.db
      .select()
      .from(captions)
      .where(
        and(eq(captions.assetId, assetId), eq(captions.userId, userId)),
      )
      .limit(1);
    return row ?? null;
  }

  async insert(row: NewCaption): Promise<CaptionRow> {
    const [created] = await this.db.insert(captions).values(row).returning();
    if (!created) throw new Error("Insert caption returned no row");
    return created;
  }
}
