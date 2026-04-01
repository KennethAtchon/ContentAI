import { and, eq } from "drizzle-orm";
import {
  captionDocs,
  type NewCaptionDoc,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export type CaptionDocRow = typeof captionDocs.$inferSelect;

export interface ICaptionsRepository {
  findByAssetAndUser(
    assetId: string,
    userId: string,
  ): Promise<CaptionDocRow | null>;

  insert(row: NewCaptionDoc): Promise<CaptionDocRow>;
}

export class CaptionsRepository implements ICaptionsRepository {
  constructor(private readonly db: AppDb) {}

  async findByAssetAndUser(
    assetId: string,
    userId: string,
  ): Promise<CaptionDocRow | null> {
    const [row] = await this.db
      .select()
      .from(captionDocs)
      .where(
        and(eq(captionDocs.assetId, assetId), eq(captionDocs.userId, userId)),
      )
      .limit(1);
    return row ?? null;
  }

  async insert(row: NewCaptionDoc): Promise<CaptionDocRow> {
    const [created] = await this.db.insert(captionDocs).values(row).returning();
    if (!created) throw new Error("Insert caption returned no row");
    return created;
  }
}
