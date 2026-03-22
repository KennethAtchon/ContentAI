import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  queueItems,
  generatedContent,
  contentAssets,
  editProjects,
} from "../../infrastructure/database/drizzle/schema";
import {
  eq,
  desc,
  asc,
  and,
  sql,
  ilike,
  or,
  inArray,
  isNull,
} from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { assertNoChainQueueItem } from "../../lib/queue-chain-guard";

type PipelineStageStatus = "pending" | "running" | "ok" | "failed";

interface PipelineStage {
  id: string;
  label: string;
  status: PipelineStageStatus;
  error?: string;
}

function deriveStages(
  row: {
    generatedHook: string | null;
    generatedScript: string | null;
    generatedMetadata: unknown;
    status: string;
    editProjectStatus?: string | null;
    latestExportStatus?: string | null;
  },
  assetRoleCounts: Record<string, number>,
): PipelineStage[] {
  const meta = (row.generatedMetadata ?? {}) as Record<string, unknown>;
  const phase4 = (meta.phase4 ?? {}) as Record<string, unknown>;
  const phase4Status = phase4.status as string | undefined;
  const contentFailed = row.status === "failed";

  const hasCopy = !!(row.generatedHook || row.generatedScript);
  const hasVoiceover = (assetRoleCounts["voiceover"] ?? 0) > 0;
  const hasVideoClips = (assetRoleCounts["video_clip"] ?? 0) > 0;
  const hasAssembled =
    (assetRoleCounts["assembled_video"] ?? 0) > 0 ||
    (assetRoleCounts["final_video"] ?? 0) > 0;

  const videoRunning = phase4Status === "running" || phase4Status === "pending";
  const videoFailed = phase4Status === "failed" || contentFailed;

  const stages: PipelineStage[] = [
    {
      id: "copy",
      label: "Copy",
      status: hasCopy ? "ok" : "pending",
    },
    {
      id: "voiceover",
      label: "Voiceover",
      status: hasVoiceover ? "ok" : "pending",
    },
    {
      id: "video",
      label: "Video clips",
      status: videoFailed
        ? "failed"
        : videoRunning
          ? "running"
          : hasVideoClips
            ? "ok"
            : "pending",
      error: videoFailed ? (phase4.error as string | undefined) : undefined,
    },
    {
      id: "assembled",
      label: "Assembly",
      status: hasAssembled ? "ok" : hasVideoClips ? "pending" : "pending",
    },
    {
      id: "edit",
      label: "Manual Edit",
      status:
        row.editProjectStatus === "published"
          ? "ok"
          : row.editProjectStatus === "draft"
            ? "running"
            : "pending",
    },
    {
      id: "export",
      label: "Export",
      status:
        row.latestExportStatus === "done"
          ? "ok"
          : row.latestExportStatus === "rendering"
            ? "running"
            : row.latestExportStatus === "failed"
              ? "failed"
              : "pending",
    },
  ];

  return stages;
}

/**
 * Walk the parentId chain to find the latest descendant (chain tip).
 * Used to determine the correct next version number.
 */
async function resolveChainTip(startId: number, userId: string) {
  const MAX_CHAIN_DEPTH = 50;
  const visitedIds = new Set<number>();
  let current = await db
    .select()
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, startId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!current) throw new Error("Content not found");

  visitedIds.add(current.id);
  let depth = 0;

  while (depth < MAX_CHAIN_DEPTH) {
    const [child] = await db
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.parentId, current.id),
          eq(generatedContent.userId, userId),
        ),
      )
      .orderBy(desc(generatedContent.createdAt))
      .limit(1);

    if (!child || visitedIds.has(child.id)) break;
    visitedIds.add(child.id);
    current = child;
    depth++;
  }

  return current;
}

/**
 * Walk up the parentId chain to find the root content ID (the v1 ancestor).
 */

const queueRouter = new Hono<HonoEnv>();

// Valid status transitions: Draft → Ready → Scheduled → Posted (Failed from any)
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["ready", "scheduled"],
  ready: ["draft", "scheduled"],
  scheduled: ["ready", "posted"],
  posted: [],
  failed: ["draft"],
};

/**
 * GET /api/queue
 * List user's queue items with generatedContent preview and optional filters.
 * Query params: status, projectId, search, sort (createdAt|scheduledFor), sortDir (asc|desc), limit, offset
 */
queueRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const status = c.req.query("status");
      const projectId = c.req.query("projectId");
      const search = c.req.query("search")?.trim();
      const sort = c.req.query("sort") ?? "createdAt";
      const sortDir = c.req.query("sortDir") ?? "desc";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
      const offset = parseInt(c.req.query("offset") ?? "0", 10);

      const conditions = [eq(queueItems.userId, auth.user.id)];
      if (status) conditions.push(eq(queueItems.status, status));
      if (projectId) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM chat_message cm
            JOIN chat_session cs ON cm.session_id = cs.id
            WHERE cm.generated_content_id = ${queueItems.generatedContentId}
            AND cs.project_id = ${projectId}
          )`,
        );
      }
      if (search) {
        const term = `%${search}%`;
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
        sort === "scheduledFor"
          ? queueItems.scheduledFor
          : queueItems.createdAt;
      const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

      const [rows, [{ total }]] = await Promise.all([
        db
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
            // Preview from generatedContent
            generatedHook: generatedContent.generatedHook,
            generatedCaption: generatedContent.generatedCaption,
            version: generatedContent.version,
            generatedScript: generatedContent.generatedScript,
            generatedMetadata: generatedContent.generatedMetadata,
            contentStatus: generatedContent.status,
            // Project info via chat link (best-effort correlated subquery)
            projectId: sql<string | null>`(
              SELECT cs.project_id FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              LIMIT 1
            )`,
            projectName: sql<string | null>`(
              SELECT p.name FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              JOIN project p ON cs.project_id = p.id
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              LIMIT 1
            )`,
            sessionId: sql<string | null>`(
              SELECT cm.session_id FROM chat_message cm
              WHERE cm.generated_content_id = ${queueItems.generatedContentId}
              LIMIT 1
            )`,
            // Editor project state (root project only — snapshots excluded)
            editProjectId: editProjects.id,
            editProjectStatus: editProjects.status,
            editProjectUpdatedAt: editProjects.updatedAt,
            // Latest export job status (correlated subqueries — table names are
            // "export_job" and "asset" as defined in schema.ts)
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
          .leftJoin(
            editProjects,
            and(
              eq(
                editProjects.generatedContentId,
                queueItems.generatedContentId,
              ),
              eq(editProjects.userId, queueItems.userId),
              isNull(editProjects.parentProjectId),
            ),
          )
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(queueItems)
          .leftJoin(
            generatedContent,
            eq(queueItems.generatedContentId, generatedContent.id),
          )
          .where(and(...conditions)),
      ]);

      // Derive pipeline stages from asset counts for all returned content IDs.
      const contentIds = rows
        .map((r) => r.generatedContentId)
        .filter((id): id is number => id !== null);

      const assetCounts = await (contentIds.length > 0
        ? db
            .select({
              generatedContentId: contentAssets.generatedContentId,
              role: contentAssets.role,
              count: sql<number>`count(*)::int`,
            })
            .from(contentAssets)
            .where(inArray(contentAssets.generatedContentId, contentIds))
            .groupBy(contentAssets.generatedContentId, contentAssets.role)
        : Promise.resolve([]));

      // Build lookup maps.
      const assetCountMap: Record<number, Record<string, number>> = {};
      for (const row of assetCounts) {
        assetCountMap[row.generatedContentId] ??= {};
        assetCountMap[row.generatedContentId][row.role] = row.count;
      }

      // Batch-resolve all root content IDs in one recursive CTE query instead
      // of N sequential per-row calls (O(N*depth) → O(1) query).
      const rootContentIds: Record<number, number> = {};
      const versionCounts: Record<number, number> = {};
      if (contentIds.length > 0) {
        const rootRows = await db
          .execute(
            sql`
              WITH RECURSIVE chain AS (
                SELECT id AS start_id, id AS cur_id, parent_id
                FROM generated_content
                WHERE id = ANY(${contentIds}::int[]) AND user_id = ${auth.user.id}
                UNION ALL
                SELECT chain.start_id, gc.id, gc.parent_id
                FROM generated_content gc
                JOIN chain ON chain.parent_id = gc.id
                WHERE gc.user_id = ${auth.user.id}
              )
              SELECT start_id::int, cur_id::int AS root_id
              FROM chain
              WHERE parent_id IS NULL
            `,
          )
          .then((r) => r as unknown as { start_id: number; root_id: number }[]);

        for (const row of rootRows) {
          rootContentIds[row.start_id] = row.root_id;
        }

        // Batch-count descendants for all unique roots in one query.
        const uniqueRoots = [...new Set(Object.values(rootContentIds))];
        const countRows = await db
          .execute(
            sql`
              WITH RECURSIVE descendants AS (
                SELECT id, id AS root_id
                FROM generated_content
                WHERE id = ANY(${uniqueRoots}::int[]) AND user_id = ${auth.user.id}
                UNION ALL
                SELECT gc.id, d.root_id
                FROM generated_content gc
                JOIN descendants d ON gc.parent_id = d.id
                WHERE gc.user_id = ${auth.user.id}
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
      }

      const items = rows.map((row) => {
        const typeCounts = assetCountMap[row.generatedContentId ?? -1] ?? {};
        const stages = deriveStages(
          {
            generatedHook: row.generatedHook,
            generatedScript: row.generatedScript,
            generatedMetadata: row.generatedMetadata,
            status: row.contentStatus ?? "draft",
            editProjectStatus: row.editProjectStatus,
            latestExportStatus: row.latestExportStatus,
          },
          typeCounts,
        );
        const rootId = row.generatedContentId
          ? (rootContentIds[row.generatedContentId] ?? null)
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
          generatedCaption: row.generatedCaption,
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

      return c.json({ items, total });
    } catch (error) {
      debugLog.error("Failed to fetch queue", {
        service: "queue-route",
        operation: "listQueue",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch queue" }, 500);
    }
  },
);

/**
 * POST /api/queue
 * Create a queue item from a generatedContentId.
 */
queueRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();
      const generatedContentId = body?.generatedContentId as number | undefined;

      if (!generatedContentId || typeof generatedContentId !== "number") {
        return c.json({ error: "generatedContentId is required" }, 400);
      }

      // Verify content exists and belongs to user
      const [content] = await db
        .select()
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, generatedContentId),
            eq(generatedContent.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (!content) return c.json({ error: "Content not found" }, 404);

      // Check for an existing queue item to prevent duplicates.
      const [existing] = await db
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(
          and(
            eq(queueItems.generatedContentId, generatedContentId),
            eq(queueItems.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (existing) {
        return c.json({ error: "Content is already in the queue" }, 409);
      }

      await assertNoChainQueueItem(
        db,
        generatedContentId,
        auth.user.id,
        "add_to_queue_endpoint",
      );
      const [queueItem] = await db
        .insert(queueItems)
        .values({
          userId: auth.user.id,
          generatedContentId,
          status: "draft",
        })
        .returning();

      // Mark content as queued
      await db
        .update(generatedContent)
        .set({ status: "queued" })
        .where(eq(generatedContent.id, generatedContentId));

      return c.json({ queueItem }, 201);
    } catch (error) {
      debugLog.error("Failed to create queue item", {
        service: "queue-route",
        operation: "createQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create queue item" }, 500);
    }
  },
);

/**
 * GET /api/queue/:id/detail
 * Full content detail for a queue item: generated content + assets + composition info.
 */
queueRouter.get(
  "/:id/detail",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const [item] = await db
        .select()
        .from(queueItems)
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)))
        .limit(1);

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      let content = null;

      if (item.generatedContentId) {
        const [contentRow] = await db
          .select()
          .from(generatedContent)
          .where(eq(generatedContent.id, item.generatedContentId))
          .limit(1);
        content = contentRow ?? null;
      }

      const sessionId = await db
        .execute(
          sql`SELECT cm.session_id FROM chat_message cm WHERE cm.generated_content_id = ${item.generatedContentId} LIMIT 1`,
        )
        .then(
          (r) =>
            (r[0] as { session_id: string } | undefined)?.session_id ?? null,
        );

      return c.json({
        queueItem: item,
        content,
        sessionId,
      });
    } catch (error) {
      debugLog.error("Failed to fetch queue item detail", {
        service: "queue-route",
        operation: "getQueueItemDetail",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch queue item detail" }, 500);
    }
  },
);

/**
 * POST /api/queue/:id/duplicate
 * Clone a queue item as a new draft (version + 1).
 */
queueRouter.post(
  "/:id/duplicate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const [item] = await db
        .select()
        .from(queueItems)
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)))
        .limit(1);

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      let newGeneratedContentId: number | null = item.generatedContentId;

      if (item.generatedContentId) {
        const [originalContent] = await db
          .select()
          .from(generatedContent)
          .where(eq(generatedContent.id, item.generatedContentId))
          .limit(1);

        if (originalContent) {
          // Resolve chain tip to get the correct next version number,
          // preventing duplicate versions when the chain has been extended via chat.
          const tip = await resolveChainTip(originalContent.id, auth.user.id);

          const [newContent] = await db
            .insert(generatedContent)
            .values({
              userId: auth.user.id,
              sourceReelId: originalContent.sourceReelId,
              prompt: originalContent.prompt,
              generatedHook: originalContent.generatedHook,
              generatedCaption: originalContent.generatedCaption,
              generatedScript: originalContent.generatedScript,
              cleanScriptForAudio: originalContent.cleanScriptForAudio,
              sceneDescription: originalContent.sceneDescription,
              generatedMetadata: originalContent.generatedMetadata,
              outputType: originalContent.outputType,
              model: originalContent.model,
              status: "draft",
              version: tip.version + 1,
              parentId: tip.id,
            })
            .returning();
          newGeneratedContentId = newContent.id;
        }
      }

      const [newItem] = await db
        .insert(queueItems)
        .values({
          userId: auth.user.id,
          generatedContentId: newGeneratedContentId,
          status: "draft",
        })
        .returning();

      return c.json(
        {
          queueItem: newItem,
          newGeneratedContentId,
        },
        201,
      );
    } catch (error) {
      debugLog.error("Failed to duplicate queue item", {
        service: "queue-route",
        operation: "duplicateQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to duplicate queue item" }, 500);
    }
  },
);

/**
 * PATCH /api/queue/:id
 * Update status (with transition validation), schedule time, or Instagram page.
 */
queueRouter.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const body = await c.req.json();
      const { scheduledFor, instagramPageId, status } = body as {
        scheduledFor?: string;
        instagramPageId?: string;
        status?: string;
      };

      const [item] = await db
        .select()
        .from(queueItems)
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)));

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      const updateData: Record<string, unknown> = {};

      if (status !== undefined) {
        if (item.status === "posted") {
          return c.json({ error: "Cannot update a posted item" }, 400);
        }
        const allowed = VALID_TRANSITIONS[item.status] ?? [];
        if (!allowed.includes(status)) {
          return c.json(
            { error: `Cannot transition from '${item.status}' to '${status}'` },
            400,
          );
        }
        updateData.status = status;
      }

      if (scheduledFor) {
        const date = new Date(scheduledFor);
        if (date <= new Date())
          return c.json({ error: "scheduledFor must be in the future" }, 400);
        updateData.scheduledFor = date;
        // Auto-advance draft/ready to scheduled when a date is set
        if (!status && (item.status === "draft" || item.status === "ready")) {
          updateData.status = "scheduled";
        }
      }

      if (instagramPageId !== undefined)
        updateData.instagramPageId = instagramPageId;

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }

      const [updated] = await db
        .update(queueItems)
        .set(updateData)
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)))
        .returning();

      return c.json({ queueItem: updated });
    } catch (error) {
      debugLog.error("Failed to update queue item", {
        service: "queue-route",
        operation: "updateQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update queue item" }, 500);
    }
  },
);

/**
 * DELETE /api/queue/:id
 * Remove a queue item.
 */
queueRouter.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

      const [item] = await db
        .select()
        .from(queueItems)
        .where(and(eq(queueItems.id, id), eq(queueItems.userId, auth.user.id)));

      if (!item) return c.json({ error: "Queue item not found" }, 404);

      await db.delete(queueItems).where(eq(queueItems.id, id));

      // Reset the generated content status to draft — only if it hasn't moved past queued.
      // Preserves "published" and other terminal states.
      if (item.generatedContentId) {
        await db
          .update(generatedContent)
          .set({ status: "draft" })
          .where(
            and(
              eq(generatedContent.id, item.generatedContentId),
              eq(generatedContent.status, "queued"),
            ),
          );
      }

      return c.json({ message: "Queue item deleted" });
    } catch (error) {
      debugLog.error("Failed to delete queue item", {
        service: "queue-route",
        operation: "deleteQueueItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete queue item" }, 500);
    }
  },
);

export default queueRouter;
