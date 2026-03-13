import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  niches,
  reels,
  reelAnalyses,
} from "../../infrastructure/database/drizzle/schema";
import { eq, sql, desc, asc, ilike, and, isNotNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { queueService } from "../../services/queue.service";

const nichesRouter = new Hono<HonoEnv>();

// ─── GET /api/admin/niches ────────────────────────────────────────────────────
// Returns all niches with aggregated reel count.

nichesRouter.get(
  "/niches",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const search = c.req.query("search")?.trim();
      const activeOnly = c.req.query("active") === "true";

      const conditions: ReturnType<typeof eq>[] = [];
      if (activeOnly) conditions.push(eq(niches.isActive, true));

      const rows = await db
        .select({
          id: niches.id,
          name: niches.name,
          description: niches.description,
          isActive: niches.isActive,
          createdAt: niches.createdAt,
          updatedAt: niches.updatedAt,
          reelCount: sql<number>`count(${reels.id})::int`,
        })
        .from(niches)
        .leftJoin(reels, eq(reels.nicheId, niches.id))
        .where(
          conditions.length > 0
            ? and(
                ...conditions,
                search ? ilike(niches.name, `%${search}%`) : undefined,
              )
            : search
              ? ilike(niches.name, `%${search}%`)
              : undefined,
        )
        .groupBy(niches.id)
        .orderBy(desc(niches.createdAt));

      return c.json({ niches: rows });
    } catch (error) {
      debugLog.error("Failed to fetch niches", {
        service: "admin-niches",
        operation: "listNiches",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch niches" }, 500);
    }
  },
);

// ─── POST /api/admin/niches ───────────────────────────────────────────────────

nichesRouter.post(
  "/niches",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const body = await c.req.json();
      const name = (body.name as string | undefined)?.trim();
      const description = (body.description as string | undefined)?.trim();
      const isActive = body.isActive !== false;

      if (!name) return c.json({ error: "name is required" }, 400);

      const [niche] = await db
        .insert(niches)
        .values({ name, description, isActive })
        .returning();

      return c.json({ niche }, 201);
    } catch (error) {
      debugLog.error("Failed to create niche", {
        service: "admin-niches",
        operation: "createNiche",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create niche" }, 500);
    }
  },
);

// ─── PUT /api/admin/niches/:id ────────────────────────────────────────────────

nichesRouter.put(
  "/niches/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      const body = await c.req.json();
      const updates: Partial<{
        name: string;
        description: string;
        isActive: boolean;
      }> = {};
      if (body.name !== undefined) updates.name = (body.name as string).trim();
      if (body.description !== undefined)
        updates.description = body.description as string;
      if (body.isActive !== undefined)
        updates.isActive = body.isActive as boolean;

      if (Object.keys(updates).length === 0)
        return c.json({ error: "No fields to update" }, 400);

      const [niche] = await db
        .update(niches)
        .set(updates)
        .where(eq(niches.id, id))
        .returning();

      if (!niche) return c.json({ error: "Niche not found" }, 404);

      return c.json({ niche });
    } catch (error) {
      debugLog.error("Failed to update niche", {
        service: "admin-niches",
        operation: "updateNiche",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update niche" }, 500);
    }
  },
);

// ─── DELETE /api/admin/niches/:id ─────────────────────────────────────────────

nichesRouter.delete(
  "/niches/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      // Check for orphaned reels
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reels)
        .where(eq(reels.nicheId, id));

      if (count > 0) {
        return c.json(
          {
            error: `Cannot delete niche with ${count} associated reels. Delete or reassign reels first.`,
          },
          409,
        );
      }

      const [deleted] = await db
        .delete(niches)
        .where(eq(niches.id, id))
        .returning();

      if (!deleted) return c.json({ error: "Niche not found" }, 404);

      return c.json({ deleted: true, niche: deleted });
    } catch (error) {
      debugLog.error("Failed to delete niche", {
        service: "admin-niches",
        operation: "deleteNiche",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete niche" }, 500);
    }
  },
);

// ─── POST /api/admin/niches/:id/scan ─────────────────────────────────────────
// Queue a scrape job for this niche with optional configuration override.

nichesRouter.post(
  "/niches/:id/scan",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      const [niche] = await db
        .select()
        .from(niches)
        .where(eq(niches.id, id))
        .limit(1);
      if (!niche) return c.json({ error: "Niche not found" }, 404);

      // Get optional configuration override from request body
      const body = await c.req.json().catch(() => ({}));
      const configOverride = {
        limit: body.limit,
        minViews: body.minViews,
        maxDaysOld: body.maxDaysOld,
        viralOnly: body.viralOnly,
      };

      // Remove undefined values
      Object.keys(configOverride).forEach(key => {
        if (configOverride[key as keyof typeof configOverride] === undefined) {
          delete configOverride[key as keyof typeof configOverride];
        }
      });

      const job = await queueService.enqueue(id, niche.name, configOverride);

      return c.json(
        {
          jobId: job.id,
          nicheId: id,
          nicheName: niche.name,
          status: job.status,
          config: {
            // Show what configuration will be used (niche defaults + any overrides)
            limit: configOverride.limit ?? niche.scrapeLimit,
            minViews: configOverride.minViews ?? niche.scrapeMinViews,
            maxDaysOld: configOverride.maxDaysOld ?? niche.scrapeMaxDaysOld,
            viralOnly: configOverride.viralOnly ?? niche.scrapeIncludeViralOnly,
          },
        },
        202,
      );
    } catch (error) {
      debugLog.error("Failed to queue niche scan", {
        service: "admin-niches",
        operation: "scanNiche",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue scan" }, 500);
    }
  },
);

// ─── GET /api/admin/niches/:id/reels ─────────────────────────────────────────
// Paginated reels for a specific niche.

nichesRouter.get(
  "/niches/:id/reels",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      const page = Math.max(parseInt(c.req.query("page") ?? "1", 10), 1);
      const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
      const offset = (page - 1) * limit;

      const sortBy = c.req.query("sortBy") ?? "views";
      const sortOrder = c.req.query("sortOrder") ?? "desc";
      const viralFilter = c.req.query("viral"); // "true" | "false" | undefined
      const hasVideoFilter = c.req.query("hasVideo"); // "true" | undefined

      const sortCol = {
        views: reels.views,
        likes: reels.likes,
        engagement: reels.engagementRate,
        postedAt: reels.postedAt,
        scrapedAt: reels.scrapedAt,
      }[sortBy] ?? reels.views;
      const order = sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

      const [niche] = await db
        .select()
        .from(niches)
        .where(eq(niches.id, id))
        .limit(1);
      if (!niche) return c.json({ error: "Niche not found" }, 404);

      const whereConditions = [eq(reels.nicheId, id)];
      if (viralFilter === "true") whereConditions.push(eq(reels.isViral, true));
      if (viralFilter === "false") whereConditions.push(eq(reels.isViral, false));
      if (hasVideoFilter === "true") whereConditions.push(isNotNull(reels.videoUrl));
      const where = and(...whereConditions);

      const [reelRows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(reels)
          .where(where)
          .orderBy(order)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(reels)
          .where(where),
      ]);

      const reelIds = reelRows.map((r) => r.id);
      const analysisRows =
        reelIds.length > 0
          ? await db
              .select({ reelId: reelAnalyses.reelId })
              .from(reelAnalyses)
              .where(
                sql`${reelAnalyses.reelId} = ANY(${sql.raw(`ARRAY[${reelIds.join(",")}]`)})`,
              )
          : [];
      const analyzedIds = new Set(analysisRows.map((a) => a.reelId));

      return c.json({
        niche,
        reels: reelRows.map((r) => ({
          ...r,
          hasAnalysis: analyzedIds.has(r.id),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      debugLog.error("Failed to fetch niche reels", {
        service: "admin-niches",
        operation: "getNicheReels",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch niche reels" }, 500);
    }
  },
);

// ─── POST /api/admin/niches/:id/dedupe ───────────────────────────────────────
// Find and hard-delete duplicate reels within this niche (by externalId).

nichesRouter.post(
  "/niches/:id/dedupe",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      // Find duplicate externalIds — keep the lowest id, delete the rest
      const duplicates = await db.execute(sql`
        DELETE FROM "reel"
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY id ASC) AS rn
            FROM "reel"
            WHERE niche_id = ${id} AND external_id IS NOT NULL
          ) sub
          WHERE rn > 1
        )
        RETURNING id
      `);

      const deletedCount =
        (duplicates as unknown as { rows: unknown[] }).rows?.length ?? 0;

      return c.json({
        nicheId: id,
        duplicatesRemoved: deletedCount,
        message: `Removed ${deletedCount} duplicate reel(s)`,
      });
    } catch (error) {
      debugLog.error("Failed to dedupe niche reels", {
        service: "admin-niches",
        operation: "dedupeNiche",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to run deduplication" }, 500);
    }
  },
);

// ─── DELETE /api/admin/reels/:reelId ─────────────────────────────────────────
// Hard-delete a specific reel.

nichesRouter.delete(
  "/reels/:reelId",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const reelId = parseInt(c.req.param("reelId"), 10);
      if (isNaN(reelId)) return c.json({ error: "Invalid reel ID" }, 400);

      const [deleted] = await db
        .delete(reels)
        .where(eq(reels.id, reelId))
        .returning();

      if (!deleted) return c.json({ error: "Reel not found" }, 404);

      return c.json({ deleted: true, reelId });
    } catch (error) {
      debugLog.error("Failed to delete reel", {
        service: "admin-niches",
        operation: "deleteReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete reel" }, 500);
    }
  },
);

// ─── GET /api/admin/niches/:id/config ─────────────────────────────────────────
// Get scraping configuration for a niche.

nichesRouter.get(
  "/niches/:id/config",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      const [niche] = await db
        .select({
          id: niches.id,
          name: niches.name,
          scrapeLimit: niches.scrapeLimit,
          scrapeMinViews: niches.scrapeMinViews,
          scrapeMaxDaysOld: niches.scrapeMaxDaysOld,
          scrapeIncludeViralOnly: niches.scrapeIncludeViralOnly,
        })
        .from(niches)
        .where(eq(niches.id, id))
        .limit(1);
      if (!niche) return c.json({ error: "Niche not found" }, 404);

      return c.json({
        id: niche.id,
        name: niche.name,
        config: {
          limit: niche.scrapeLimit,
          minViews: niche.scrapeMinViews,
          maxDaysOld: niche.scrapeMaxDaysOld,
          viralOnly: niche.scrapeIncludeViralOnly,
        },
      });
    } catch (error) {
      debugLog.error("Failed to get niche config", {
        service: "admin-niches",
        operation: "getNicheConfig",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to get niche config" }, 500);
    }
  },
);

// ─── PUT /api/admin/niches/:id/config ─────────────────────────────────────────
// Update scraping configuration for a niche.

nichesRouter.put(
  "/niches/:id/config",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

      const body = await c.req.json();
      const { limit, minViews, maxDaysOld, viralOnly } = body;

      // Validate input
      if (limit !== undefined && (typeof limit !== "number" || limit < 1 || limit > 10000)) {
        return c.json({ error: "limit must be a number between 1 and 10000" }, 400);
      }
      if (minViews !== undefined && (typeof minViews !== "number" || minViews < 0)) {
        return c.json({ error: "minViews must be a non-negative number" }, 400);
      }
      if (maxDaysOld !== undefined && (typeof maxDaysOld !== "number" || maxDaysOld < 1 || maxDaysOld > 365)) {
        return c.json({ error: "maxDaysOld must be a number between 1 and 365" }, 400);
      }
      if (viralOnly !== undefined && typeof viralOnly !== "boolean") {
        return c.json({ error: "viralOnly must be a boolean" }, 400);
      }

      const [niche] = await db
        .update(niches)
        .set({
          ...(limit !== undefined && { scrapeLimit: limit }),
          ...(minViews !== undefined && { scrapeMinViews: minViews }),
          ...(maxDaysOld !== undefined && { scrapeMaxDaysOld: maxDaysOld }),
          ...(viralOnly !== undefined && { scrapeIncludeViralOnly: viralOnly }),
          updatedAt: new Date(),
        })
        .where(eq(niches.id, id))
        .returning({
          id: niches.id,
          name: niches.name,
          scrapeLimit: niches.scrapeLimit,
          scrapeMinViews: niches.scrapeMinViews,
          scrapeMaxDaysOld: niches.scrapeMaxDaysOld,
          scrapeIncludeViralOnly: niches.scrapeIncludeViralOnly,
          updatedAt: niches.updatedAt,
        });

      if (!niche) return c.json({ error: "Niche not found" }, 404);

      return c.json({
        id: niche.id,
        name: niche.name,
        config: {
          limit: niche.scrapeLimit,
          minViews: niche.scrapeMinViews,
          maxDaysOld: niche.scrapeMaxDaysOld,
          viralOnly: niche.scrapeIncludeViralOnly,
        },
        updatedAt: niche.updatedAt,
      });
    } catch (error) {
      debugLog.error("Failed to update niche config", {
        service: "admin-niches",
        operation: "updateNicheConfig",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update niche config" }, 500);
    }
  },
);

// ─── GET /api/admin/niches/jobs/:jobId ───────────────────────────────────────
// Poll the status of a scrape job.

nichesRouter.get(
  "/niches/jobs/:jobId",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const jobId = c.req.param("jobId");
      const job = await queueService.getJob(jobId);
      if (!job) return c.json({ error: "Job not found" }, 404);
      return c.json({ job });
    } catch (error) {
      debugLog.error("Failed to get job status", {
        service: "admin-niches",
        operation: "getJobStatus",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to get job status" }, 500);
    }
  },
);

// ─── GET /api/admin/niches/:id/jobs ──────────────────────────────────────────
// List recent scrape jobs for a niche.

nichesRouter.get(
  "/niches/:id/jobs",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);
      const jobs = await queueService.listJobs(id);
      return c.json({ jobs });
    } catch (error) {
      debugLog.error("Failed to list jobs", {
        service: "admin-niches",
        operation: "listJobs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to list jobs" }, 500);
    }
  },
);

export default nichesRouter;
