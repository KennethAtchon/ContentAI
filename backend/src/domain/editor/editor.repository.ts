import { and, eq } from "drizzle-orm";
import { editProjects } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export type EditProjectRow = typeof editProjects.$inferSelect;

export interface IEditorRepository {
  findByIdAndUserId(
    projectId: string,
    userId: string,
  ): Promise<EditProjectRow | null>;

  updateTracksDurationMerged(
    projectId: string,
    patch: Pick<
      EditProjectRow,
      "tracks" | "durationMs" | "mergedAssetIds"
    >,
  ): Promise<void>;
}

export class EditorRepository implements IEditorRepository {
  constructor(private readonly db: AppDb) {}

  async findByIdAndUserId(
    projectId: string,
    userId: string,
  ): Promise<EditProjectRow | null> {
    const [row] = await this.db
      .select()
      .from(editProjects)
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      )
      .limit(1);
    return row ?? null;
  }

  async updateTracksDurationMerged(
    projectId: string,
    patch: Pick<
      EditProjectRow,
      "tracks" | "durationMs" | "mergedAssetIds"
    >,
  ): Promise<void> {
    await this.db
      .update(editProjects)
      .set({
        tracks: patch.tracks,
        durationMs: patch.durationMs,
        mergedAssetIds: patch.mergedAssetIds,
      })
      .where(eq(editProjects.id, projectId));
  }
}
