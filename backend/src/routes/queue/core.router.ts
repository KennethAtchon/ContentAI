import { Hono } from "hono";
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
import { debugLog } from "../../utils/debug/debug";
import { assertNoChainQueueItem } from "../../lib/queue-chain-guard";
import { deriveStages } from "../../domain/queue/pipeline/stage-derivation";

const coreRouter = new Hono<HonoEnv>();

coreRouter.get(
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
            postCaption: generatedContent.postCaption,
            version: generatedContent.version,
            generatedScript: generatedContent.generatedScript,
            generatedMetadata: generatedContent.generatedMetadata,
            contentStatus: generatedContent.status,
            // Project info via chat link (best-effort correlated subquery)
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
            // Editor project state (root project only — snapshots excluded)
            editProjectId: editProjects.id,
            editProjectStatus: editProjects.status,
            editProjectTracks: editProjects.tracks,
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
        // Drizzle expands JS arrays in sql`...` into multiple params, which breaks
        // ANY($n::int[]). Use IN (...) via sql.join so each id is one bound param.
        const idList = sql.join(
          contentIds.map((id) => sql`${id}`),
          sql`, `,
        );
        const rootRows = await db
          .execute(
            sql`
              WITH RECURSIVE chain AS (
                SELECT id AS start_id, id AS cur_id, parent_id
                FROM generated_content
                WHERE id IN (${idList}) AND user_id = ${auth.user.id}
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
        const rootIdList =
          uniqueRoots.length > 0
            ? sql.join(
                uniqueRoots.map((id) => sql`${id}`),
                sql`, `,
              )
            : null;
        const countRows =
          uniqueRoots.length > 0 && rootIdList
            ? await db
                .execute(
                  sql`
              WITH RECURSIVE descendants AS (
                SELECT id, id AS root_id
                FROM generated_content
                WHERE id IN (${rootIdList}) AND user_id = ${auth.user.id}
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
                .then(
                  (r) => r as unknown as { root_id: number; count: number }[],
                )
            : [];

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
            editProjectId: row.editProjectId,
            editProjectTracks: row.editProjectTracks,
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
coreRouter.post(
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

export default coreRouter;
