import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  assets,
  contentAssets,
  editProjects,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";
import { rootEditProjectJoinQueueItems } from "./queue-editor-join";
import { assertNoChainQueueItem } from "../../lib/queue-chain-guard";
import { resolveChainTip } from "./pipeline/content-chain";

export type QueueItemRow = typeof queueItems.$inferSelect;

export type QueueListQueryInput = {
  userId: string;
  status?: string;
  projectId?: string;
  search?: string;
  sort: "createdAt" | "scheduledFor";
  sortDir: "asc" | "desc";
  limit: number;
  offset: number;
};

/** Row shape returned by the queue list SQL (before `deriveStages` mapping). */
export type QueueListDbRow = {
  id: number;
  userId: string;
  generatedContentId: number | null;
  scheduledFor: Date | null;
  postedAt: Date | null;
  instagramPageId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  generatedHook: string | null;
  postCaption: string | null;
  version: number | null;
  generatedScript: string | null;
  generatedMetadata: unknown;
  contentStatus: string | null;
  projectId: string | null;
  projectName: string | null;
  sessionId: string | null;
  editProjectId: string | null;
  editProjectStatus: string | null;
  editProjectTracks: unknown;
  editProjectUpdatedAt: Date | null;
  latestExportStatus: string | null;
  latestExportUrl: string | null;
};

export type AssetRoleCountRow = {
  generatedContentId: number;
  role: string;
  count: number;
};

export type ContentAssetJoinRow = {
  id: string;
  role: string;
  r2Key: string | null;
  r2Url: string | null;
  durationMs: number | null;
  metadata: unknown;
  createdAt: Date;
};

export type ContentVersionChainRow = {
  id: number;
  version: number;
  generatedHook: string | null;
  postCaption: string | null;
  generatedScript: string | null;
  voiceoverScript: string | null;
  sceneDescription: string | null;
  createdAt: Date;
};

export interface IQueueRepository {
  countScheduledByUserId(userId: string): Promise<number>;
  markDraftOrScheduledReadyByContent(
    userId: string,
    generatedContentId: number,
  ): Promise<void>;

  listQueueItemsPage(
    input: QueueListQueryInput,
  ): Promise<{ rows: QueueListDbRow[]; total: number }>;

  aggregateAssetRoleCountsByContentIds(
    contentIds: number[],
  ): Promise<AssetRoleCountRow[]>;

  batchResolveRootContentIdsForUser(
    userId: string,
    contentIds: number[],
  ): Promise<{ rootByStartId: Record<number, number> }>;

  batchCountDescendantsByRootForUser(
    userId: string,
    rootIds: number[],
  ): Promise<Record<number, number>>;

  findGeneratedContentForUser(
    userId: string,
    contentId: number,
  ): Promise<typeof generatedContent.$inferSelect | null>;

  findQueueItemByContentAndUser(
    userId: string,
    generatedContentId: number,
  ): Promise<{ id: number } | null>;

  createDraftQueueItemAndMarkContentQueued(
    userId: string,
    generatedContentId: number,
  ): Promise<QueueItemRow>;

  findQueueItemByIdForUser(
    id: number,
    userId: string,
  ): Promise<QueueItemRow | null>;

  findGeneratedContentById(
    contentId: number,
  ): Promise<typeof generatedContent.$inferSelect | null>;

  fetchLatestChatSessionForContent(
    generatedContentId: number,
  ): Promise<{ sessionId: string; projectId: string } | null>;

  listContentAssetsJoinedForContent(
    generatedContentId: number,
  ): Promise<ContentAssetJoinRow[]>;

  fetchContentAncestorChainForUser(
    userId: string,
    tipContentId: number,
  ): Promise<ContentVersionChainRow[]>;

  insertGeneratedContentDuplicateFromOriginal(
    userId: string,
    original: typeof generatedContent.$inferSelect,
    tip: typeof generatedContent.$inferSelect,
  ): Promise<typeof generatedContent.$inferSelect>;

  insertQueueItemDraft(
    userId: string,
    generatedContentId: number | null,
  ): Promise<QueueItemRow>;

  updateQueueItemForUser(
    id: number,
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<QueueItemRow | null>;

  deleteQueueItemForUser(
    id: number,
    userId: string,
  ): Promise<QueueItemRow | null>;

  duplicateQueueItemForUser(
    userId: string,
    queueItemId: number,
  ): Promise<{
    queueItem: QueueItemRow;
    newGeneratedContentId: number | null;
  } | null>;
}

export class QueueRepository implements IQueueRepository {
  constructor(private readonly db: AppDb) {}

  async countScheduledByUserId(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.userId, userId),
          eq(queueItems.status, "scheduled"),
        ),
      );
    return row?.count ?? 0;
  }

  async markDraftOrScheduledReadyByContent(
    userId: string,
    generatedContentId: number,
  ): Promise<void> {
    await this.db
      .update(queueItems)
      .set({ status: "ready" })
      .where(
        and(
          eq(queueItems.generatedContentId, generatedContentId),
          eq(queueItems.userId, userId),
          inArray(queueItems.status, ["draft", "scheduled"]),
        ),
      );
  }

  async listQueueItemsPage(
    input: QueueListQueryInput,
  ): Promise<{ rows: QueueListDbRow[]; total: number }> {
    const conditions = [eq(queueItems.userId, input.userId)];
    if (input.status) conditions.push(eq(queueItems.status, input.status));
    if (input.projectId) {
      conditions.push(
        sql`EXISTS (
            SELECT 1 FROM chat_message cm
            JOIN chat_session cs ON cm.session_id = cs.id
            WHERE cm.generated_content_id = ${queueItems.generatedContentId}
            AND cs.project_id = ${input.projectId}
          )`,
      );
    }
    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(generatedContent.generatedHook, term),
          sql`EXISTS (
              SELECT 1 FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              JOIN project p ON cs.project_id = p.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              AND p.name ILIKE ${term}
            )`,
        ) as ReturnType<typeof eq>,
      );
    }

    const sortColumn =
      input.sort === "scheduledFor"
        ? queueItems.scheduledFor
        : queueItems.createdAt;
    const orderBy =
      input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: queueItems.id,
          userId: queueItems.userId,
          generatedContentId: queueItems.generatedContentId,
          scheduledFor: queueItems.scheduledFor,
          postedAt: queueItems.postedAt,
          instagramPageId: queueItems.instagramPageId,
          status: queueItems.status,
          errorMessage: queueItems.errorMessage,
          createdAt: queueItems.createdAt,
          generatedHook: generatedContent.generatedHook,
          postCaption: generatedContent.postCaption,
          version: generatedContent.version,
          generatedScript: generatedContent.generatedScript,
          generatedMetadata: generatedContent.generatedMetadata,
          contentStatus: generatedContent.status,
          projectId: sql<string | null>`(
              SELECT cs.project_id FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              ORDER BY cs.updated_at DESC
              LIMIT 1
            )`,
          projectName: sql<string | null>`(
              SELECT p.name FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              JOIN project p ON cs.project_id = p.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              ORDER BY cs.updated_at DESC
              LIMIT 1
            )`,
          sessionId: sql<string | null>`(
              SELECT cm.session_id FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              ORDER BY cs.updated_at DESC
              LIMIT 1
            )`,
          editProjectId: editProjects.id,
          editProjectStatus: editProjects.status,
          editProjectTracks: editProjects.tracks,
          editProjectUpdatedAt: editProjects.updatedAt,
          latestExportStatus: sql<string | null>`(
              SELECT status FROM export_job
              WHERE edit_project_id = ${editProjects.id}
              ORDER BY created_at DESC
              LIMIT 1
            )`,
          latestExportUrl: sql<string | null>`(
              SELECT a.r2_url FROM export_job ej
              JOIN asset a ON a.id = ej.output_asset_id
              WHERE ej.edit_project_id = ${editProjects.id}
                AND ej.status = 'done'
              ORDER BY ej.created_at DESC
              LIMIT 1
            )`,
        })
        .from(queueItems)
        .leftJoin(
          generatedContent,
          eq(queueItems.generatedContentId, generatedContent.id),
        )
        .leftJoin(editProjects, rootEditProjectJoinQueueItems)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(queueItems)
        .leftJoin(
          generatedContent,
          eq(queueItems.generatedContentId, generatedContent.id),
        )
        .where(and(...conditions)),
    ]);

    return { rows: rows as QueueListDbRow[], total };
  }

  async aggregateAssetRoleCountsByContentIds(
    contentIds: number[],
  ): Promise<AssetRoleCountRow[]> {
    if (contentIds.length === 0) return [];
    const rows = await this.db
      .select({
        generatedContentId: contentAssets.generatedContentId,
        role: contentAssets.role,
        count: sql<number>`count(*)::int`,
      })
      .from(contentAssets)
      .where(inArray(contentAssets.generatedContentId, contentIds))
      .groupBy(contentAssets.generatedContentId, contentAssets.role);
    return rows as AssetRoleCountRow[];
  }

  async batchResolveRootContentIdsForUser(
    userId: string,
    contentIds: number[],
  ): Promise<{ rootByStartId: Record<number, number> }> {
    const rootByStartId: Record<number, number> = {};
    if (contentIds.length === 0) return { rootByStartId };

    const idList = sql.join(
      contentIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const rootRows = await this.db
      .execute(
        sql`
              WITH RECURSIVE chain AS (
                SELECT id AS start_id, id AS cur_id, parent_id
                FROM generated_content
                WHERE id IN (${idList}) AND user_id = ${userId}
                UNION ALL
                SELECT chain.start_id, gc.id, gc.parent_id
                FROM generated_content gc
                JOIN chain ON chain.parent_id = gc.id
                WHERE gc.user_id = ${userId}
              )
              SELECT start_id::int, cur_id::int AS root_id
              FROM chain
              WHERE parent_id IS NULL
            `,
      )
      .then((r) => r as unknown as { start_id: number; root_id: number }[]);

    for (const row of rootRows) {
      rootByStartId[row.start_id] = row.root_id;
    }
    return { rootByStartId };
  }

  async batchCountDescendantsByRootForUser(
    userId: string,
    rootIds: number[],
  ): Promise<Record<number, number>> {
    const versionCounts: Record<number, number> = {};
    const uniqueRoots = [...new Set(rootIds)];
    if (uniqueRoots.length === 0) return versionCounts;

    const rootIdList = sql.join(
      uniqueRoots.map((id) => sql`${id}`),
      sql`, `,
    );
    const countRows = await this.db
      .execute(
        sql`
              WITH RECURSIVE descendants AS (
                SELECT id, id AS root_id
                FROM generated_content
                WHERE id IN (${rootIdList}) AND user_id = ${userId}
                UNION ALL
                SELECT gc.id, d.root_id
                FROM generated_content gc
                JOIN descendants d ON gc.parent_id = d.id
                WHERE gc.user_id = ${userId}
              )
              SELECT root_id::int, count(*)::int AS count
              FROM descendants
              GROUP BY root_id
            `,
      )
      .then((r) => r as unknown as { root_id: number; count: number }[]);

    for (const row of countRows) {
      versionCounts[row.root_id] = row.count;
    }
    return versionCounts;
  }

  async findGeneratedContentForUser(
    userId: string,
    contentId: number,
  ): Promise<typeof generatedContent.$inferSelect | null> {
    const [content] = await this.db
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    return content ?? null;
  }

  async findQueueItemByContentAndUser(
    userId: string,
    generatedContentId: number,
  ): Promise<{ id: number } | null> {
    const [existing] = await this.db
      .select({ id: queueItems.id })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.generatedContentId, generatedContentId),
          eq(queueItems.userId, userId),
        ),
      )
      .limit(1);
    return existing ?? null;
  }

  async createDraftQueueItemAndMarkContentQueued(
    userId: string,
    generatedContentId: number,
  ): Promise<QueueItemRow> {
    return this.db.transaction(async (tx) => {
      await assertNoChainQueueItem(
        tx,
        generatedContentId,
        userId,
        "add_to_queue_endpoint",
      );
      const [queueItem] = await tx
        .insert(queueItems)
        .values({
          userId,
          generatedContentId,
          status: "draft",
        })
        .returning();

      await tx
        .update(generatedContent)
        .set({ status: "queued" })
        .where(eq(generatedContent.id, generatedContentId));

      return queueItem;
    });
  }

  async findQueueItemByIdForUser(
    id: number,
    userId: string,
  ): Promise<QueueItemRow | null> {
    const [item] = await this.db
      .select()
      .from(queueItems)
      .where(and(eq(queueItems.id, id), eq(queueItems.userId, userId)))
      .limit(1);
    return item ?? null;
  }

  async findGeneratedContentById(
    contentId: number,
  ): Promise<typeof generatedContent.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.id, contentId))
      .limit(1);
    return row ?? null;
  }

  async fetchLatestChatSessionForContent(
    generatedContentId: number,
  ): Promise<{ sessionId: string; projectId: string } | null> {
    const sessionRow = await this.db
      .execute(
        sql`SELECT cm.session_id, cs.project_id
              FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              WHERE cm.generated_content_id = ${generatedContentId}
              ORDER BY cs.updated_at DESC
              LIMIT 1`,
      )
      .then(
        (r) =>
          (r[0] as { session_id: string; project_id: string } | undefined) ??
          null,
      );
    if (!sessionRow) return null;
    return {
      sessionId: sessionRow.session_id,
      projectId: sessionRow.project_id,
    };
  }

  async listContentAssetsJoinedForContent(
    generatedContentId: number,
  ): Promise<ContentAssetJoinRow[]> {
    const assetRows = await this.db
      .select({
        id: assets.id,
        role: contentAssets.role,
        r2Key: assets.r2Key,
        r2Url: assets.r2Url,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
        createdAt: assets.createdAt,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(eq(contentAssets.generatedContentId, generatedContentId));
    return assetRows as ContentAssetJoinRow[];
  }

  async fetchContentAncestorChainForUser(
    userId: string,
    tipContentId: number,
  ): Promise<ContentVersionChainRow[]> {
    const chainRows = await this.db.execute(
      sql`
            WITH RECURSIVE chain AS (
              SELECT id, version, generated_hook, post_caption,
                     generated_script, voiceover_script,
                     scene_description, created_at, parent_id
              FROM generated_content
              WHERE id = ${tipContentId} AND user_id = ${userId}
              UNION ALL
              SELECT gc.id, gc.version, gc.generated_hook, gc.post_caption,
                     gc.generated_script, gc.voiceover_script,
                     gc.scene_description, gc.created_at, gc.parent_id
              FROM generated_content gc
              JOIN chain ON gc.id = chain.parent_id
              WHERE gc.user_id = ${userId}
            )
            SELECT id::int, version::int, generated_hook, post_caption,
                   generated_script, voiceover_script, scene_description,
                   created_at
            FROM chain
            ORDER BY version ASC
          `,
    );

    const mapped = (
      chainRows as unknown as Array<{
        id: number;
        version: number;
        generated_hook: string | null;
        post_caption: string | null;
        generated_script: string | null;
        voiceover_script: string | null;
        scene_description: string | null;
        created_at: Date;
      }>
    ).map((r) => ({
      id: r.id,
      version: r.version,
      generatedHook: r.generated_hook,
      postCaption: r.post_caption,
      generatedScript: r.generated_script,
      voiceoverScript: r.voiceover_script,
      sceneDescription: r.scene_description,
      createdAt: r.created_at,
    }));
    return mapped;
  }

  async insertGeneratedContentDuplicateFromOriginal(
    userId: string,
    original: typeof generatedContent.$inferSelect,
    tip: typeof generatedContent.$inferSelect,
  ): Promise<typeof generatedContent.$inferSelect> {
    const [newContent] = await this.db
      .insert(generatedContent)
      .values({
        userId,
        sourceReelId: original.sourceReelId,
        prompt: original.prompt,
        generatedHook: original.generatedHook,
        postCaption: original.postCaption,
        generatedScript: original.generatedScript,
        voiceoverScript: original.voiceoverScript,
        sceneDescription: original.sceneDescription,
        generatedMetadata: original.generatedMetadata,
        outputType: original.outputType,
        model: original.model,
        status: "draft",
        version: tip.version + 1,
        parentId: tip.id,
      })
      .returning();
    return newContent;
  }

  async insertQueueItemDraft(
    userId: string,
    generatedContentId: number | null,
  ): Promise<QueueItemRow> {
    const [newItem] = await this.db
      .insert(queueItems)
      .values({
        userId,
        generatedContentId,
        status: "draft",
      })
      .returning();
    return newItem;
  }

  async updateQueueItemForUser(
    id: number,
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<QueueItemRow | null> {
    const [updated] = await this.db
      .update(queueItems)
      .set(patch)
      .where(and(eq(queueItems.id, id), eq(queueItems.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async deleteQueueItemForUser(
    id: number,
    userId: string,
  ): Promise<QueueItemRow | null> {
    const item = await this.findQueueItemByIdForUser(id, userId);
    if (!item) return null;
    await this.db.delete(queueItems).where(eq(queueItems.id, id));
    if (item.generatedContentId) {
      await this.db
        .update(generatedContent)
        .set({ status: "draft" })
        .where(
          and(
            eq(generatedContent.id, item.generatedContentId),
            eq(generatedContent.status, "queued"),
          ),
        );
    }
    return item;
  }

  async duplicateQueueItemForUser(
    userId: string,
    queueItemId: number,
  ): Promise<{
    queueItem: QueueItemRow;
    newGeneratedContentId: number | null;
  } | null> {
    const item = await this.findQueueItemByIdForUser(queueItemId, userId);
    if (!item) return null;

    let newGeneratedContentId: number | null = item.generatedContentId;

    if (item.generatedContentId) {
      const originalContent = await this.findGeneratedContentById(
        item.generatedContentId,
      );
      if (originalContent) {
        const tip = await resolveChainTip(
          originalContent.id,
          userId,
          this.db,
        );
        const newContent = await this.insertGeneratedContentDuplicateFromOriginal(
          userId,
          originalContent,
          tip,
        );
        newGeneratedContentId = newContent.id;
      }
    }

    const newItem = await this.insertQueueItemDraft(
      userId,
      newGeneratedContentId,
    );
    return { queueItem: newItem, newGeneratedContentId };
  }
}
