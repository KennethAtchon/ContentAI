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

  findByIdAndUser(
    captionDocId: string,
    userId: string,
  ): Promise<CaptionDocRow | null>;

  insert(row: NewCaptionDoc): Promise<CaptionDocRow>;

  updateByIdAndUser(
    captionDocId: string,
    userId: string,
    patch: Pick<NewCaptionDoc, "tokens" | "fullText" | "language">,
  ): Promise<CaptionDocRow | null>;
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

  async findByIdAndUser(
    captionDocId: string,
    userId: string,
  ): Promise<CaptionDocRow | null> {
    const [row] = await this.db
      .select()
      .from(captionDocs)
      .where(
        and(
          eq(captionDocs.id, captionDocId),
          eq(captionDocs.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insert(row: NewCaptionDoc): Promise<CaptionDocRow> {
    const [created] = await this.db.insert(captionDocs).values(row).returning();
    if (!created) throw new Error("Insert caption returned no row");
    return created;
  }

  async updateByIdAndUser(
    captionDocId: string,
    userId: string,
    patch: Pick<NewCaptionDoc, "tokens" | "fullText" | "language">,
  ): Promise<CaptionDocRow | null> {
    const [updated] = await this.db
      .update(captionDocs)
      .set({
        tokens: patch.tokens,
        fullText: patch.fullText,
        language: patch.language,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(captionDocs.id, captionDocId),
          eq(captionDocs.userId, userId),
        ),
      )
      .returning();
    return updated ?? null;
  }
}
