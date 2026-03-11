import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  reels,
  niches,
  reelAnalyses,
} from "../../infrastructure/database/drizzle/schema";
import { eq, desc, gte, ilike, sql, and } from "drizzle-orm";
import { analyzeReel } from "../../services/reels/reel-analyzer";
import { VIRAL_VIEWS_THRESHOLD } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";

const reelsRouter = new Hono<HonoEnv>();

/**
 * GET /api/reels/niches
 * Returns the list of active niches for frontend dropdowns.
 */
reelsRouter.get(
  "/niches",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const rows = await db
        .select({ id: niches.id, name: niches.name })
        .from(niches)
        .where(eq(niches.isActive, true))
        .orderBy(niches.name);

      return c.json({ niches: rows });
    } catch (error) {
      debugLog.error("Failed to fetch niches", {
        service: "reels-route",
        operation: "listNiches",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch niches" }, 500);
    }
  },
);

/**
 * GET /api/reels
 * List reels filtered by nicheId (preferred) or niche name, paginated.
 */
reelsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const nicheIdParam = c.req.query("nicheId");
      const nicheNameParam = c.req.query("niche") ?? "";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
      const offset = parseInt(c.req.query("offset") ?? "0", 10);
      const minViews = parseInt(
        c.req.query("minViews") ?? String(VIRAL_VIEWS_THRESHOLD),
        10,
      );
      const sort = c.req.query("sort") ?? "views";

      const orderBy =
        sort === "engagement"
          ? desc(reels.engagementRate)
          : sort === "recent"
            ? desc(reels.createdAt)
            : desc(reels.views);

      const conditions: ReturnType<typeof gte>[] = [gte(reels.views, minViews)];

      if (nicheIdParam) {
        const nicheId = parseInt(nicheIdParam, 10);
        if (!isNaN(nicheId)) conditions.push(eq(reels.nicheId, nicheId) as ReturnType<typeof gte>);
      } else if (nicheNameParam) {
        // Resolve name → id via sub-select
        const [matched] = await db
          .select({ id: niches.id })
          .from(niches)
          .where(ilike(niches.name, `%${nicheNameParam}%`))
          .limit(1);
        if (matched) conditions.push(eq(reels.nicheId, matched.id) as ReturnType<typeof gte>);
      }

      const [reelRows, [{ total }]] = await Promise.all([
        db
          .select({
            id: reels.id,
            username: reels.username,
            nicheId: reels.nicheId,
            views: reels.views,
            likes: reels.likes,
            comments: reels.comments,
            engagementRate: reels.engagementRate,
            hook: reels.hook,
            thumbnailEmoji: reels.thumbnailEmoji,
            daysAgo: reels.daysAgo,
            isViral: reels.isViral,
            audioName: reels.audioName,
            createdAt: reels.createdAt,
          })
          .from(reels)
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(reels)
          .where(and(...conditions)),
      ]);

      // Check which reels have analysis
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
        reels: reelRows.map((r) => ({
          ...r,
          hasAnalysis: analyzedIds.has(r.id),
        })),
        total,
        nicheId: nicheIdParam ?? null,
        niche: nicheNameParam,
      });
    } catch (error) {
      debugLog.error("Failed to fetch reels", {
        service: "reels-route",
        operation: "listReels",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch reels" }, 500);
    }
  },
);

/**
 * GET /api/reels/:id
 * Single reel with its analysis (if available).
 */
reelsRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid reel ID" }, 400);

      const [reel] = await db.select().from(reels).where(eq(reels.id, id));
      if (!reel) return c.json({ error: "Reel not found" }, 404);

      const [analysis] = await db
        .select()
        .from(reelAnalyses)
        .where(eq(reelAnalyses.reelId, id));

      return c.json({ reel, analysis: analysis ?? null });
    } catch (error) {
      debugLog.error("Failed to fetch reel", {
        service: "reels-route",
        operation: "getReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch reel" }, 500);
    }
  },
);

/**
 * POST /api/reels/:id/analyze
 * Trigger AI analysis for a specific reel.
 */
reelsRouter.post(
  "/:id/analyze",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ error: "Invalid reel ID" }, 400);

      const analysis = await analyzeReel(id);
      return c.json({ analysis });
    } catch (error) {
      debugLog.error("Failed to analyze reel", {
        service: "reels-route",
        operation: "analyzeReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to analyze reel" }, 500);
    }
  },
);

/**
 * GET /api/reels/export
 * Export reels and their AI analysis for a niche (CSV or JSON).
 */
reelsRouter.get(
  "/export",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const nicheIdParam = c.req.query("nicheId");
      const nicheNameParam = c.req.query("niche");
      const format = c.req.query("format") ?? "json";
      const minViews = parseInt(
        c.req.query("minViews") ?? String(VIRAL_VIEWS_THRESHOLD),
        10,
      );

      if (!nicheIdParam && !nicheNameParam) {
        return c.json({ error: "nicheId or niche parameter is required for export" }, 400);
      }

      let resolvedNicheId: number | null = null;

      if (nicheIdParam) {
        resolvedNicheId = parseInt(nicheIdParam, 10);
      } else if (nicheNameParam) {
        const [matched] = await db
          .select({ id: niches.id })
          .from(niches)
          .where(ilike(niches.name, `%${nicheNameParam}%`))
          .limit(1);
        if (matched) resolvedNicheId = matched.id;
      }

      if (!resolvedNicheId) {
        return c.json({ error: "No matching niche found" }, 404);
      }

      // Fetch all viral reels for the niche
      const reelRows = await db
        .select()
        .from(reels)
        .where(and(gte(reels.views, minViews), eq(reels.nicheId, resolvedNicheId)))
        .orderBy(desc(reels.views));

      if (reelRows.length === 0) {
        return c.json(
          { error: "No reels found to export for this niche" },
          404,
        );
      }

      // Fetch all analyses for these reels
      const reelIds = reelRows.map((r) => r.id);
      const analysisRows = await db
        .select()
        .from(reelAnalyses)
        .where(
          sql`${reelAnalyses.reelId} = ANY(${sql.raw(`ARRAY[${reelIds.join(",")}]`)})`,
        );

      const analysisMap = new Map(analysisRows.map((a) => [a.reelId, a]));

      let totalEngagement = 0;
      const exportData = reelRows.map((r) => {
        const rate = Number(r.engagementRate) || 0;
        totalEngagement += rate;
        const analysis = analysisMap.get(r.id);

        return {
          reelId: r.id,
          url: `https://instagram.com/${r.username}/reel/${r.id}`,
          views: r.views,
          likes: r.likes,
          comments: r.comments,
          engagementRate: r.engagementRate,
          hook: r.hook,
          caption: r.caption,
          audioName: r.audioName,
          hookPattern: analysis?.hookPattern,
          hookCategory: analysis?.hookCategory,
          emotionalTrigger: analysis?.emotionalTrigger,
          formatPattern: analysis?.formatPattern,
          remixSuggestion: analysis?.remixSuggestion,
        };
      });

      const avgEngagementRate =
        exportData.length > 0
          ? Number((totalEngagement / exportData.length).toFixed(2))
          : 0;

      if (format === "csv") {
        const { parse } = await import("json2csv");
        const csv = parse(exportData);

        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="reels_export_${resolvedNicheId}.csv"`,
          },
        });
      }

      return c.json({
        nicheId: resolvedNicheId,
        generatedAt: new Date().toISOString(),
        totalReels: exportData.length,
        avgEngagementRate,
        topReels: exportData,
      });
    } catch (error) {
      debugLog.error("Failed to export reels", {
        service: "reels-route",
        operation: "exportReels",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to export reels" }, 500);
    }
  },
);

export default reelsRouter;
