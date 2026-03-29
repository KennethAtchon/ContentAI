import { Hono } from "hono";
import { eq, and, sql, desc, isNull } from "drizzle-orm";
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
  assets,
  exportJobs,
} from "../../infrastructure/database/drizzle/schema";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl } from "../../services/storage/r2";
import { resolveChainTip } from "../../domain/queue/pipeline/content-chain";
import { queueDetailAssetType } from "../../domain/queue/pipeline/asset-display";
import { VALID_QUEUE_TRANSITIONS } from "./constants";

const itemsRouter = new Hono<HonoEnv>();

itemsRouter.get(
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

      const sessionRow = await db
        .execute(
          sql`SELECT cm.session_id, cs.project_id
              FROM chat_message cm
              JOIN chat_session cs ON cm.session_id = cs.id
              WHERE cm.generated_content_id = ${item.generatedContentId}
              ORDER BY cs.updated_at DESC
              LIMIT 1`,
        )
        .then(
          (r) =>
            (r[0] as { session_id: string; project_id: string } | undefined) ?? null,
        );
      const sessionId = sessionRow?.session_id ?? null;
      const projectId = sessionRow?.project_id ?? null;

      let detailAssets: Array<{
        id: string;
        type: string;
        r2Url: string | null;
        durationMs: number | null;
        metadata: unknown;
        createdAt: string;
      }> = [];

      if (item.generatedContentId) {
        const assetRows = await db
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
          .where(eq(contentAssets.generatedContentId, item.generatedContentId));

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

      // Collect the full version chain by walking up parent_id from the current
      // tip. Returns rows sorted oldest → newest (v1 first).
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
        const chainRows = await db.execute(
          sql`
            WITH RECURSIVE chain AS (
              SELECT id, version, generated_hook, post_caption,
                     generated_script, voiceover_script,
                     scene_description, created_at, parent_id
              FROM generated_content
              WHERE id = ${item.generatedContentId} AND user_id = ${auth.user.id}
              UNION ALL
              SELECT gc.id, gc.version, gc.generated_hook, gc.post_caption,
                     gc.generated_script, gc.voiceover_script,
                     gc.scene_description, gc.created_at, gc.parent_id
              FROM generated_content gc
              JOIN chain ON gc.id = chain.parent_id
              WHERE gc.user_id = ${auth.user.id}
            )
            SELECT id::int, version::int, generated_hook, post_caption,
                   generated_script, voiceover_script, scene_description,
                   created_at
            FROM chain
            ORDER BY version ASC
          `,
        );

        versions = (
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
          createdAt:
            r.created_at instanceof Date
              ? r.created_at.toISOString()
              : String(r.created_at),
        }));
      }

      let latestExportUrl: string | null = null;
      let latestExportStatus: string | null = null;

      if (item.generatedContentId) {
        const [latestJob] = await db
          .select({ status: exportJobs.status })
          .from(exportJobs)
          .innerJoin(
            editProjects,
            eq(exportJobs.editProjectId, editProjects.id),
          )
          .where(
            and(
              eq(
                editProjects.generatedContentId,
                item.generatedContentId,
              ),
              eq(editProjects.userId, auth.user.id),
              isNull(editProjects.parentProjectId),
            ),
          )
          .orderBy(desc(exportJobs.createdAt))
          .limit(1);

        latestExportStatus = latestJob?.status ?? null;

        const [latestDone] = await db
          .select({
            r2Url: assets.r2Url,
            r2Key: assets.r2Key,
          })
          .from(exportJobs)
          .innerJoin(
            editProjects,
            eq(exportJobs.editProjectId, editProjects.id),
          )
          .innerJoin(assets, eq(exportJobs.outputAssetId, assets.id))
          .where(
            and(
              eq(
                editProjects.generatedContentId,
                item.generatedContentId,
              ),
              eq(editProjects.userId, auth.user.id),
              isNull(editProjects.parentProjectId),
              eq(exportJobs.status, "done"),
            ),
          )
          .orderBy(desc(exportJobs.createdAt))
          .limit(1);

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

      return c.json({
        queueItem: item,
        content,
        sessionId,
        projectId,
        assets: detailAssets,
        versions,
        latestExportUrl,
        latestExportStatus,
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
itemsRouter.post(
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
              postCaption: originalContent.postCaption,
              generatedScript: originalContent.generatedScript,
              voiceoverScript: originalContent.voiceoverScript,
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
itemsRouter.patch(
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
        const allowed = VALID_QUEUE_TRANSITIONS[item.status] ?? [];
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
itemsRouter.delete(
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

export default itemsRouter;
