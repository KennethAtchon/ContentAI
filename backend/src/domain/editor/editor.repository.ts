import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  assets,
  contentAssets,
  editProjects,
  exportJobs,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import type { NewEditProject } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";
import {
  mergePlaceholdersWithRealClips,
  type AssetMergeRow,
  type TimelineTrackJson,
} from "./timeline/merge-placeholders-with-assets";
import { parseStoredEditorTracks } from "./validate-stored-tracks";

export type EditProjectRow = typeof editProjects.$inferSelect;
export type ExportJobRow = typeof exportJobs.$inferSelect;

const RACE_LOST = "RACE_LOST";

export interface IEditorRepository {
  findByIdAndUserId(
    projectId: string,
    userId: string,
  ): Promise<EditProjectRow | null>;

  /**
   * Find all editor projects for a user linked to any of the given content IDs.
   * Used by SyncService.syncLinkedProjects to find projects across the full
   * ancestor chain of a content version.
   */
  findProjectsByContentIds(
    userId: string,
    contentIds: number[],
  ): Promise<Array<{ id: string; tracks: unknown; durationMs: number }>>;

  /**
   * Write synced tracks and denormalized content fields to an editor project.
   *
   * IMPORTANT: Must NOT bump any autosave/conflict version field.
   * Sync writes are transparent to the editor's conflict detection system.
   *
   * TODO (Phase 2 — AI direct-edit):
   * Add applyClipOperations(projectId, userId, ops: ClipOperation[]): Promise<void>
   * for AI tools that directly mutate individual clips (trim, reorder, insert, delete)
   * without going through a full content re-derive. Must not bump the conflict version.
   * See chat-tools.ts ToolContext for the onEditorAction callback and ClipOperation shape.
   */
  updateProjectForSync(
    projectId: string,
    userId: string,
    data: {
      tracks: unknown;
      durationMs: number;
      generatedContentId: number;
    },
  ): Promise<void>;

  listForUserWithGeneratedContent(userId: string): Promise<
    Array<{
      id: string;
      userId: string;
      title: string;
      generatedContentId: number | null;
      durationMs: number;
      fps: number;
      resolution: string;
      status: string;
      publishedAt: Date | null;
      parentProjectId: string | null;
      createdAt: Date;
      updatedAt: Date;
      autoTitle: boolean;
      thumbnailUrl: string | null;
      generatedHook: string | null;
      postCaption: string | null;
    }>
  >;

  findRootProjectIdInContentChain(
    userId: string,
    chainIds: number[],
  ): Promise<string | null>;

  insertProject(values: NewEditProject): Promise<EditProjectRow>;

  findAutosaveMeta(
    projectId: string,
    userId: string,
  ): Promise<Pick<
    EditProjectRow,
    "id" | "status" | "title" | "autoTitle"
  > | null>;

  updateProjectForUser(
    projectId: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; updatedAt: Date } | undefined>;

  listProjectTracksForUser(
    userId: string,
    excludeProjectId?: string,
  ): Promise<Array<{ id: string; tracks: unknown }>>;

  existsByIdForUser(projectId: string, userId: string): Promise<boolean>;

  deleteByIdForUser(projectId: string, userId: string): Promise<void>;

  setThumbnailUrlForUser(
    projectId: string,
    userId: string,
    thumbnailUrl: string,
  ): Promise<void>;

  hasCompletedExportForProject(editProjectId: string): Promise<boolean>;

  markPublishedForUser(
    projectId: string,
    userId: string,
  ): Promise<{
    id: string;
    status: string;
    publishedAt: Date | null;
    generatedContentId: number | null;
  } | null>;

  /** Insert draft `generated_content`, link project if still blank, enqueue queue row. Handles unique race. */
  createDraftContentAndLinkBlankProject(
    userId: string,
    projectId: string,
  ): Promise<number>;

  findRootProjectByIdForUser(
    projectId: string,
    userId: string,
  ): Promise<EditProjectRow | null>;

  listSnapshotSummariesForRoot(
    rootId: string,
    userId: string,
  ): Promise<Array<{ id: string; createdAt: Date; status: string }>>;

  findSnapshotChildOfRoot(
    rootId: string,
    snapshotId: string,
    userId: string,
  ): Promise<EditProjectRow | null>;

  forkRootToSnapshotAndOptionalAiReset(params: {
    root: EditProjectRow;
    validatedTracks: unknown;
    aiTimeline: { tracks: unknown; durationMs: number } | null;
  }): Promise<{ snapshotId: string }>;

  restoreRootFromSnapshot(params: {
    root: EditProjectRow;
    snapshot: EditProjectRow;
    validatedRootTracks: unknown;
    validatedSnapshotTracks: unknown;
  }): Promise<void>;

  countRenderingExportJobsByUser(userId: string): Promise<number>;

  insertQueuedExportJob(
    editProjectId: string,
    userId: string,
  ): Promise<{ id: string }>;

  findLatestExportJobForProject(
    editProjectId: string,
    userId: string,
  ): Promise<ExportJobRow | null>;

  updateExportJob(
    jobId: string,
    patch: {
      status?: string;
      progress?: number;
      error?: string | null;
      outputAssetId?: string | null;
    },
  ): Promise<void>;

  /** Walk `parent_id` from `contentId` through `generated_content` (inclusive), inside a transaction. */
  resolveContentParentIdChainInTx(
    tx: AppDb,
    contentId: number,
    userId: string,
  ): Promise<number[]>;

  /** Root edit project for any `generatedContentId` in `chain`, row-locked (`FOR UPDATE`). */
  lockRootEditProjectForContentChainInTx(
    tx: AppDb,
    userId: string,
    chain: number[],
  ): Promise<EditProjectRow | undefined>;

  setProjectTracksInTx(
    tx: AppDb,
    projectId: string,
    tracks: unknown,
  ): Promise<void>;

  findLatestExportStatusForRootProjectByContentId(
    userId: string,
    generatedContentId: number,
  ): Promise<string | null>;

  findLatestDoneExportOutputR2ForRootProjectByContentId(
    userId: string,
    generatedContentId: number,
  ): Promise<{ r2Key: string | null; r2Url: string | null } | null>;

  /** Merge `content_asset` rows into the root editor project's tracks (transaction + row lock). */
  refreshEditorTimeline(
    contentId: number,
    userId: string,
    options?: {
      placeholderStatus?: "pending" | "generating" | "failed";
      shotIndex?: number;
    },
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

  async findProjectsByContentIds(
    userId: string,
    contentIds: number[],
  ): Promise<Array<{ id: string; tracks: unknown; durationMs: number }>> {
    if (contentIds.length === 0) return [];
    return this.db
      .select({
        id: editProjects.id,
        tracks: editProjects.tracks,
        durationMs: editProjects.durationMs,
      })
      .from(editProjects)
      .where(
        and(
          eq(editProjects.userId, userId),
          inArray(editProjects.generatedContentId, contentIds),
          isNull(editProjects.parentProjectId),
        ),
      );
  }

  async updateProjectForSync(
    projectId: string,
    userId: string,
    data: {
      tracks: unknown;
      durationMs: number;
      generatedContentId: number;
    },
  ): Promise<void> {
    // updatedAt advances via $onUpdateFn so the editor's poll picks up the change.
    // We never touch the autosave conflict version — sync is transparent to the
    // editor's conflict detection system.
    // generatedHook and postCaption are not stored on edit_projects; they come
    // via JOIN from generated_content, so advancing generatedContentId is enough.
    await this.db
      .update(editProjects)
      .set({
        tracks: data.tracks,
        durationMs: data.durationMs,
        generatedContentId: data.generatedContentId,
      })
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      );
  }

  async listForUserWithGeneratedContent(userId: string) {
    return this.db
      .select({
        id: editProjects.id,
        userId: editProjects.userId,
        title: editProjects.title,
        generatedContentId: editProjects.generatedContentId,
        durationMs: editProjects.durationMs,
        fps: editProjects.fps,
        resolution: editProjects.resolution,
        status: editProjects.status,
        publishedAt: editProjects.publishedAt,
        parentProjectId: editProjects.parentProjectId,
        createdAt: editProjects.createdAt,
        updatedAt: editProjects.updatedAt,
        autoTitle: editProjects.autoTitle,
        thumbnailUrl: editProjects.thumbnailUrl,
        generatedHook: generatedContent.generatedHook,
        postCaption: generatedContent.postCaption,
      })
      .from(editProjects)
      .leftJoin(
        generatedContent,
        eq(editProjects.generatedContentId, generatedContent.id),
      )
      .where(eq(editProjects.userId, userId))
      .orderBy(desc(editProjects.updatedAt));
  }

  async findRootProjectIdInContentChain(
    userId: string,
    chainIds: number[],
  ): Promise<string | null> {
    if (chainIds.length === 0) return null;
    const [row] = await this.db
      .select({ id: editProjects.id })
      .from(editProjects)
      .where(
        and(
          eq(editProjects.userId, userId),
          inArray(editProjects.generatedContentId, chainIds),
          isNull(editProjects.parentProjectId),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async insertProject(values: NewEditProject): Promise<EditProjectRow> {
    const [row] = await this.db.insert(editProjects).values(values).returning();
    if (!row) {
      throw new Error("Insert edit project returned no row");
    }
    return row;
  }

  async findAutosaveMeta(projectId: string, userId: string) {
    const [row] = await this.db
      .select({
        id: editProjects.id,
        status: editProjects.status,
        title: editProjects.title,
        autoTitle: editProjects.autoTitle,
      })
      .from(editProjects)
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      )
      .limit(1);
    return row ?? null;
  }

  async updateProjectForUser(
    projectId: string,
    userId: string,
    data: Record<string, unknown>,
  ) {
    const [updated] = await this.db
      .update(editProjects)
      .set(data)
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      )
      .returning({ id: editProjects.id, updatedAt: editProjects.updatedAt });
    return updated;
  }

  async listProjectTracksForUser(
    userId: string,
    excludeProjectId?: string,
  ): Promise<Array<{ id: string; tracks: unknown }>> {
    return this.db
      .select({ id: editProjects.id, tracks: editProjects.tracks })
      .from(editProjects)
      .where(
        excludeProjectId
          ? and(
              eq(editProjects.userId, userId),
              ne(editProjects.id, excludeProjectId),
            )
          : eq(editProjects.userId, userId),
      );
  }

  async existsByIdForUser(projectId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: editProjects.id })
      .from(editProjects)
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      )
      .limit(1);
    return !!row;
  }

  async deleteByIdForUser(projectId: string, userId: string): Promise<void> {
    await this.db
      .delete(editProjects)
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      );
  }

  async setThumbnailUrlForUser(
    projectId: string,
    userId: string,
    thumbnailUrl: string,
  ): Promise<void> {
    await this.db
      .update(editProjects)
      .set({ thumbnailUrl })
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      );
  }

  async hasCompletedExportForProject(editProjectId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: exportJobs.id })
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.editProjectId, editProjectId),
          eq(exportJobs.status, "done"),
        ),
      )
      .limit(1);
    return !!row;
  }

  async markPublishedForUser(projectId: string, userId: string) {
    const [updated] = await this.db
      .update(editProjects)
      .set({ status: "published", publishedAt: new Date() })
      .where(
        and(eq(editProjects.id, projectId), eq(editProjects.userId, userId)),
      )
      .returning({
        id: editProjects.id,
        status: editProjects.status,
        publishedAt: editProjects.publishedAt,
        generatedContentId: editProjects.generatedContentId,
      });
    return updated ?? null;
  }

  async createDraftContentAndLinkBlankProject(
    userId: string,
    projectId: string,
  ): Promise<number> {
    try {
      return await this.db.transaction(async (tx) => {
        const [newContent] = await tx
          .insert(generatedContent)
          .values({
            userId,
            prompt: null,
            status: "draft",
            version: 1,
            outputType: "full",
          })
          .returning({ id: generatedContent.id });

        const updated = await tx
          .update(editProjects)
          .set({ generatedContentId: newContent.id })
          .where(
            and(
              eq(editProjects.id, projectId),
              eq(editProjects.userId, userId),
              isNull(editProjects.generatedContentId),
            ),
          )
          .returning({ generatedContentId: editProjects.generatedContentId });

        if (!updated[0]) {
          throw new Error(RACE_LOST);
        }

        await tx.insert(queueItems).values({
          userId,
          generatedContentId: newContent.id,
          status: "draft",
        });

        return newContent.id;
      });
    } catch (err) {
      if (err instanceof Error && err.message === RACE_LOST) {
        const [row] = await this.db
          .select({ generatedContentId: editProjects.generatedContentId })
          .from(editProjects)
          .where(
            and(
              eq(editProjects.id, projectId),
              eq(editProjects.userId, userId),
            ),
          )
          .limit(1);
        if (row?.generatedContentId != null) {
          return row.generatedContentId;
        }
      }
      throw err;
    }
  }

  async findRootProjectByIdForUser(projectId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(editProjects)
      .where(
        and(
          eq(editProjects.id, projectId),
          eq(editProjects.userId, userId),
          isNull(editProjects.parentProjectId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listSnapshotSummariesForRoot(rootId: string, userId: string) {
    return this.db
      .select({
        id: editProjects.id,
        createdAt: editProjects.createdAt,
        status: editProjects.status,
      })
      .from(editProjects)
      .where(
        and(
          eq(editProjects.parentProjectId, rootId),
          eq(editProjects.userId, userId),
        ),
      )
      .orderBy(desc(editProjects.createdAt));
  }

  async findSnapshotChildOfRoot(
    rootId: string,
    snapshotId: string,
    userId: string,
  ) {
    const [row] = await this.db
      .select()
      .from(editProjects)
      .where(
        and(
          eq(editProjects.id, snapshotId),
          eq(editProjects.userId, userId),
          eq(editProjects.parentProjectId, rootId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async forkRootToSnapshotAndOptionalAiReset(params: {
    root: EditProjectRow;
    validatedTracks: unknown;
    aiTimeline: { tracks: unknown; durationMs: number } | null;
  }): Promise<{ snapshotId: string }> {
    const { root, validatedTracks, aiTimeline } = params;
    const [snapshot] = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(editProjects)
        .values({
          userId: root.userId,
          generatedContentId: root.generatedContentId,
          tracks: validatedTracks,
          durationMs: root.durationMs,
          fps: root.fps,
          resolution: root.resolution,
          status: "draft",
          title: root.title,
          parentProjectId: root.id,
        })
        .returning({ id: editProjects.id });

      if (aiTimeline) {
        await tx
          .update(editProjects)
          .set({
            tracks: aiTimeline.tracks,
            durationMs: aiTimeline.durationMs,
            status: "draft",
          })
          .where(eq(editProjects.id, root.id));
      }

      return inserted;
    });
    return { snapshotId: snapshot.id };
  }

  async restoreRootFromSnapshot(params: {
    root: EditProjectRow;
    snapshot: EditProjectRow;
    validatedRootTracks: unknown;
    validatedSnapshotTracks: unknown;
  }): Promise<void> {
    const { root, snapshot, validatedRootTracks, validatedSnapshotTracks } =
      params;
    await this.db.transaction(async (tx) => {
      await tx.insert(editProjects).values({
        userId: root.userId,
        generatedContentId: root.generatedContentId,
        tracks: validatedRootTracks,
        durationMs: root.durationMs,
        fps: root.fps,
        resolution: root.resolution,
        status: "draft",
        title: root.title,
        parentProjectId: root.id,
      });

      await tx
        .update(editProjects)
        .set({
          tracks: validatedSnapshotTracks,
          durationMs: snapshot.durationMs,
          status: "draft",
        })
        .where(eq(editProjects.id, root.id));
    });
  }

  async countRenderingExportJobsByUser(userId: string): Promise<number> {
    const [{ activeJobs }] = await this.db
      .select({ activeJobs: count() })
      .from(exportJobs)
      .where(
        and(eq(exportJobs.userId, userId), eq(exportJobs.status, "rendering")),
      );
    return activeJobs;
  }

  async insertQueuedExportJob(editProjectId: string, userId: string) {
    const [job] = await this.db
      .insert(exportJobs)
      .values({
        editProjectId,
        userId,
        status: "queued",
        progress: 0,
      })
      .returning({ id: exportJobs.id });
    if (!job) {
      throw new Error("Insert export job returned no row");
    }
    return job;
  }

  async findLatestExportJobForProject(
    editProjectId: string,
    userId: string,
  ): Promise<ExportJobRow | null> {
    const [row] = await this.db
      .select()
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.editProjectId, editProjectId),
          eq(exportJobs.userId, userId),
        ),
      )
      .orderBy(desc(exportJobs.createdAt))
      .limit(1);
    return row ?? null;
  }

  async updateExportJob(
    jobId: string,
    patch: {
      status?: string;
      progress?: number;
      error?: string | null;
      outputAssetId?: string | null;
    },
  ): Promise<void> {
    const data = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<typeof exportJobs.$inferInsert>;
    if (Object.keys(data).length === 0) return;
    await this.db.update(exportJobs).set(data).where(eq(exportJobs.id, jobId));
  }

  async resolveContentParentIdChainInTx(
    tx: AppDb,
    contentId: number,
    userId: string,
  ): Promise<number[]> {
    const chain: number[] = [contentId];
    let cur = contentId;
    while (true) {
      const [row] = await tx
        .select({ parentId: generatedContent.parentId })
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, cur),
            eq(generatedContent.userId, userId),
          ),
        )
        .limit(1);
      if (!row?.parentId) break;
      chain.push(row.parentId);
      cur = row.parentId;
    }
    return chain;
  }

  async lockRootEditProjectForContentChainInTx(
    tx: AppDb,
    userId: string,
    chain: number[],
  ): Promise<EditProjectRow | undefined> {
    const rows = await tx
      .select()
      .from(editProjects)
      .where(
        and(
          eq(editProjects.userId, userId),
          inArray(editProjects.generatedContentId, chain),
          isNull(editProjects.parentProjectId),
        ),
      )
      .for("update")
      .limit(1);
    return rows[0];
  }

  async setProjectTracksInTx(
    tx: AppDb,
    projectId: string,
    tracks: unknown,
  ): Promise<void> {
    await tx
      .update(editProjects)
      .set({ tracks })
      .where(eq(editProjects.id, projectId));
  }

  async findLatestExportStatusForRootProjectByContentId(
    userId: string,
    generatedContentId: number,
  ): Promise<string | null> {
    const [row] = await this.db
      .select({ status: exportJobs.status })
      .from(exportJobs)
      .innerJoin(editProjects, eq(exportJobs.editProjectId, editProjects.id))
      .where(
        and(
          eq(editProjects.generatedContentId, generatedContentId),
          eq(editProjects.userId, userId),
          isNull(editProjects.parentProjectId),
        ),
      )
      .orderBy(desc(exportJobs.createdAt))
      .limit(1);
    return row?.status ?? null;
  }

  async findLatestDoneExportOutputR2ForRootProjectByContentId(
    userId: string,
    generatedContentId: number,
  ): Promise<{ r2Key: string | null; r2Url: string | null } | null> {
    const [row] = await this.db
      .select({ r2Key: assets.r2Key, r2Url: assets.r2Url })
      .from(exportJobs)
      .innerJoin(editProjects, eq(exportJobs.editProjectId, editProjects.id))
      .innerJoin(assets, eq(exportJobs.outputAssetId, assets.id))
      .where(
        and(
          eq(editProjects.generatedContentId, generatedContentId),
          eq(editProjects.userId, userId),
          isNull(editProjects.parentProjectId),
          eq(exportJobs.status, "done"),
        ),
      )
      .orderBy(desc(exportJobs.createdAt))
      .limit(1);
    return row ?? null;
  }

  async refreshEditorTimeline(
    contentId: number,
    userId: string,
    options?: {
      placeholderStatus?: "pending" | "generating" | "failed";
      shotIndex?: number;
    },
  ) {
    await this.db.transaction(async (tx) => {
      const dbx = tx as AppDb;
      const chain = await this.resolveContentParentIdChainInTx(
        dbx,
        contentId,
        userId,
      );

      const project = await this.lockRootEditProjectForContentChainInTx(
        dbx,
        userId,
        chain,
      );
      if (!project) return;

      const assetRows = await tx
        .select({
          id: assets.id,
          role: contentAssets.role,
          durationMs: assets.durationMs,
          metadata: assets.metadata,
        })
        .from(contentAssets)
        .innerJoin(assets, eq(contentAssets.assetId, assets.id))
        .where(eq(contentAssets.generatedContentId, contentId));

      const videoClipRows: AssetMergeRow[] = assetRows
        .filter((a) => a.role === "video_clip")
        .map((a) => ({
          id: a.id,
          role: a.role,
          durationMs: a.durationMs,
          metadata: a.metadata,
        }));
      const voiceover = assetRows.find((a) => a.role === "voiceover");
      const music = assetRows.find((a) => a.role === "background_music");

      const currentTracks = parseStoredEditorTracks(
        project.tracks,
      ) as unknown as TimelineTrackJson[];

      const incomingVideoIds = new Set(videoClipRows.map((a) => a.id));
      const incomingVoiceoverId = voiceover?.id ?? null;
      const incomingMusicId = music?.id ?? null;

      const videoTrack = currentTracks.find((t) => t.type === "video");
      const audioTrack = currentTracks.find((t) => t.type === "audio");
      const musicTrack = currentTracks.find((t) => t.type === "music");

      const existingVideoIds = new Set(
        (videoTrack?.clips ?? [])
          .filter(
            (c) => c.isPlaceholder !== true && typeof c.assetId === "string",
          )
          .map((c) => c.assetId as string),
      );
      const existingVoiceoverId =
        audioTrack?.clips.find(
          (c) => typeof c.id === "string" && c.id.startsWith("voiceover-"),
        )?.assetId ?? null;
      const existingMusicId =
        musicTrack?.clips.find(
          (c) => typeof c.id === "string" && c.id.startsWith("music-"),
        )?.assetId ?? null;

      const hasPlaceholders = (videoTrack?.clips ?? []).some(
        (c) => c.isPlaceholder === true,
      );
      const videoIdsMatch =
        incomingVideoIds.size === existingVideoIds.size &&
        [...incomingVideoIds].every((id) => existingVideoIds.has(id));

      if (
        videoIdsMatch &&
        incomingVoiceoverId === existingVoiceoverId &&
        incomingMusicId === existingMusicId &&
        !hasPlaceholders
      ) {
        return;
      }

      const updatedTracks = mergePlaceholdersWithRealClips(
        currentTracks,
        videoClipRows,
        voiceover
          ? {
              id: voiceover.id,
              role: voiceover.role,
              durationMs: voiceover.durationMs,
              metadata: voiceover.metadata,
            }
          : undefined,
        music
          ? {
              id: music.id,
              role: music.role,
              durationMs: music.durationMs,
              metadata: music.metadata,
            }
          : undefined,
        options,
      );

      await this.setProjectTracksInTx(dbx, project.id, updatedTracks);
    });
  }
}
