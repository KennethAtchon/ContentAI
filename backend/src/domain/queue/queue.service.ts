import { QueueChainError } from "../../lib/queue-chain-guard";
import { getFileUrl } from "../../services/storage/r2";
import { Errors } from "../../utils/errors/app-error";
import type { EditorRepository } from "../editor/editor.repository";
import { deriveStages } from "./pipeline/stage-derivation";
import { queueDetailAssetType } from "./pipeline/asset-display";
import type { IQueueRepository, QueueListQueryInput } from "./queue.repository";
import { VALID_QUEUE_TRANSITIONS } from "./queue-transitions";
import type { z } from "zod";
import type {
  queueListQuerySchema,
  updateQueueItemBodySchema,
} from "./queue.schemas";
import { generatedContent } from "../../infrastructure/database/drizzle/schema";

type GeneratedContentRow = typeof generatedContent.$inferSelect;

export class QueueService {
  constructor(
    private readonly queue: IQueueRepository,
    private readonly editor: EditorRepository,
  ) {}

  countScheduledForUser(userId: string) {
    return this.queue.countScheduledByUserId(userId);
  }

  async listQueueItemsPage(
    userId: string,
    query: z.infer<typeof queueListQuerySchema>,
  ) {
    const input: QueueListQueryInput = {
      userId,
      status: query.status,
      projectId: query.projectId,
      search: query.search,
      sort: query.sort,
      sortDir: query.sortDir,
      limit: query.limit,
      offset: query.offset,
    };

    const { rows, total } = await this.queue.listQueueItemsPage(input);

    const contentIds = rows
      .map((r) => r.generatedContentId)
      .filter((id): id is number => id !== null);

    const assetCounts =
      await this.queue.aggregateAssetRoleCountsByContentIds(contentIds);

    const assetCountMap: Record<number, Record<string, number>> = {};
    for (const row of assetCounts) {
      assetCountMap[row.generatedContentId] ??= {};
      assetCountMap[row.generatedContentId][row.role] = row.count;
    }

    const { rootByStartId } =
      await this.queue.batchResolveRootContentIdsForUser(userId, contentIds);

    const uniqueRoots = [...new Set(Object.values(rootByStartId))];
    const versionCounts = await this.queue.batchCountDescendantsByRootForUser(
      userId,
      uniqueRoots,
    );

    const items = rows.map((row) => {
      const typeCounts = assetCountMap[row.generatedContentId ?? -1] ?? {};
      const stages = deriveStages(
        {
          generatedHook: row.generatedHook,
          generatedScript: row.generatedScript,
          generatedMetadata: row.generatedMetadata,
          status: row.contentStatus ?? "draft",
          editProjectId: row.editProjectId,
          editProjectTracks: row.editProjectTracks,
          latestExportStatus: row.latestExportStatus,
        },
        typeCounts,
      );
      const rootId = row.generatedContentId
        ? (rootByStartId[row.generatedContentId] ?? null)
        : null;
      return {
        id: row.id,
        userId: row.userId,
        generatedContentId: row.generatedContentId,
        scheduledFor: row.scheduledFor,
        postedAt: row.postedAt,
        instagramPageId: row.instagramPageId,
        status: row.status,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
        generatedHook: row.generatedHook,
        postCaption: row.postCaption,
        version: row.version,
        projectId: row.projectId,
        projectName: row.projectName,
        sessionId: row.sessionId,
        stages,
        rootContentId: rootId,
        versionCount: rootId ? (versionCounts[rootId] ?? 1) : 1,
        editProjectId: row.editProjectId ?? null,
        editProjectStatus: row.editProjectStatus ?? null,
        latestExportStatus: row.latestExportStatus ?? null,
        latestExportUrl: row.latestExportUrl ?? null,
      };
    });

    return { items, total };
  }

  async createDraftQueueItem(userId: string, generatedContentId: number) {
    const content = await this.queue.findGeneratedContentForUser(
      userId,
      generatedContentId,
    );
    if (!content) throw Errors.notFound("Content");

    const existing = await this.queue.findQueueItemByContentAndUser(
      userId,
      generatedContentId,
    );
    if (existing) {
      throw Errors.conflict(
        "Content is already in the queue",
        "QUEUE_ITEM_EXISTS",
      );
    }

    try {
      const queueItem = await this.queue.createDraftQueueItemAndMarkContentQueued(
        userId,
        generatedContentId,
      );
      return { queueItem };
    } catch (e) {
      if (e instanceof QueueChainError) {
        throw Errors.conflict(
          "This content chain already has a queue item — update that item instead",
          "QUEUE_CHAIN_GUARD",
        );
      }
      throw e;
    }
  }

  async createScheduledQueueItem(
    userId: string,
    generatedContentId: number,
    scheduledFor: Date | null,
  ) {
    const content = await this.queue.findGeneratedContentForUser(
      userId,
      generatedContentId,
    );
    if (!content) throw Errors.notFound("Content");

    try {
      const queueItem = await this.queue.createScheduledQueueItem(
        userId,
        generatedContentId,
        scheduledFor,
      );
      return { queueItem };
    } catch (e) {
      if (e instanceof QueueChainError) {
        throw Errors.conflict(
          "This content chain already has a queue item — update that item instead",
          "QUEUE_CHAIN_GUARD",
        );
      }
      throw e;
    }
  }

  async getQueueItemDetail(userId: string, queueItemId: number) {
    const item = await this.queue.findQueueItemByIdForUser(
      queueItemId,
      userId,
    );
    if (!item) throw Errors.notFound("Queue item");

    let content: GeneratedContentRow | null = null;
    if (item.generatedContentId) {
      content = await this.queue.findGeneratedContentById(
        item.generatedContentId,
      );
    }

    const sessionRow = item.generatedContentId
      ? await this.queue.fetchLatestChatSessionForContent(
          item.generatedContentId,
        )
      : null;
    const sessionId = sessionRow?.sessionId ?? null;
    const projectId = sessionRow?.projectId ?? null;

    let detailAssets: Array<{
      id: string;
      type: string;
      r2Url: string | null;
      durationMs: number | null;
      metadata: unknown;
      createdAt: string;
    }> = [];

    if (item.generatedContentId) {
      const assetRows = await this.queue.listContentAssetsJoinedForContent(
        item.generatedContentId,
      );
      detailAssets = await Promise.all(
        assetRows.map(async (r) => {
          let url: string | null = r.r2Url;
          if (r.r2Key) {
            try {
              url = await getFileUrl(r.r2Key, 3600);
            } catch {
              url = r.r2Url;
            }
          }
          return {
            id: r.id,
            type: queueDetailAssetType(r.role),
            r2Url: url,
            durationMs: r.durationMs,
            metadata: r.metadata,
            createdAt: r.createdAt.toISOString(),
          };
        }),
      );
    }

    let versions: Array<{
      id: number;
      version: number;
      generatedHook: string | null;
      postCaption: string | null;
      generatedScript: string | null;
      voiceoverScript: string | null;
      sceneDescription: string | null;
      createdAt: string;
    }> = [];

    if (item.generatedContentId) {
      const chain = await this.queue.fetchContentAncestorChainForUser(
        userId,
        item.generatedContentId,
      );
      versions = chain.map((r) => ({
        id: r.id,
        version: r.version,
        generatedHook: r.generatedHook,
        postCaption: r.postCaption,
        generatedScript: r.generatedScript,
        voiceoverScript: r.voiceoverScript,
        sceneDescription: r.sceneDescription,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      }));
    }

    let latestExportUrl: string | null = null;
    let latestExportStatus: string | null = null;

    if (item.generatedContentId) {
      latestExportStatus =
        await this.editor.findLatestExportStatusForRootProjectByContentId(
          userId,
          item.generatedContentId,
        );

      const latestDone =
        await this.editor.findLatestDoneExportOutputR2ForRootProjectByContentId(
          userId,
          item.generatedContentId,
        );

      if (latestDone) {
        let url = latestDone.r2Url;
        if (latestDone.r2Key) {
          try {
            url = await getFileUrl(latestDone.r2Key, 3600);
          } catch {
            /* keep r2Url */
          }
        }
        latestExportUrl = url;
      }
    }

    return {
      queueItem: item,
      content,
      sessionId,
      projectId,
      assets: detailAssets,
      versions,
      latestExportUrl,
      latestExportStatus,
    };
  }

  async duplicateQueueItem(userId: string, queueItemId: number) {
    const result = await this.queue.duplicateQueueItemForUser(
      userId,
      queueItemId,
    );
    if (!result) throw Errors.notFound("Queue item");
    return result;
  }

  async updateQueueItem(
    userId: string,
    queueItemId: number,
    body: z.infer<typeof updateQueueItemBodySchema>,
  ) {
    const item = await this.queue.findQueueItemByIdForUser(
      queueItemId,
      userId,
    );
    if (!item) throw Errors.notFound("Queue item");

    const updateData: Record<string, unknown> = {};
    const { scheduledFor, instagramPageId, status } = body;

    if (status !== undefined) {
      if (item.status === "posted") {
        throw Errors.badRequest(
          "Cannot update a posted item",
          "QUEUE_POSTED_IMMUTABLE",
        );
      }
      const allowed = VALID_QUEUE_TRANSITIONS[item.status] ?? [];
      if (!allowed.includes(status)) {
        throw Errors.badRequest(
          `Cannot transition from '${item.status}' to '${status}'`,
          "QUEUE_INVALID_TRANSITION",
        );
      }
      updateData.status = status;
    }

    if (scheduledFor) {
      const date = new Date(scheduledFor);
      if (date <= new Date()) {
        throw Errors.badRequest(
          "scheduledFor must be in the future",
          "QUEUE_SCHEDULE_PAST",
        );
      }
      updateData.scheduledFor = date;
      if (!status && (item.status === "draft" || item.status === "ready")) {
        updateData.status = "scheduled";
      }
    }

    if (instagramPageId !== undefined)
      updateData.instagramPageId = instagramPageId;

    if (Object.keys(updateData).length === 0) {
      throw Errors.badRequest("No fields to update", "QUEUE_NO_UPDATES");
    }

    const updated = await this.queue.updateQueueItemForUser(
      queueItemId,
      userId,
      updateData,
    );
    if (!updated) throw Errors.notFound("Queue item");
    return { queueItem: updated };
  }

  async deleteQueueItem(userId: string, queueItemId: number) {
    const deleted = await this.queue.deleteQueueItemForUser(
      queueItemId,
      userId,
    );
    if (!deleted) throw Errors.notFound("Queue item");
    return { message: "Queue item deleted" as const };
  }
}
