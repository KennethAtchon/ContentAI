import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import {
  reels,
  niches,
  reelAnalyses,
} from "../../infrastructure/database/drizzle/schema";
import { eq, desc, gte, ilike, sql, and, or, inArray } from "drizzle-orm";
import { analyzeReel } from "../../services/reels/reel-analyzer";
import { usageGate, recordUsage } from "../../middleware/usage-gate";
import { getFileUrl, extractKeyFromUrl } from "../../services/storage/r2";
import { VIRAL_VIEWS_THRESHOLD } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";
import {
  generatedContent,
  queueItems,
  featureUsages,
} from "../../infrastructure/database/drizzle/schema";
import {
  bulkReelsSchema,
  reelIdParamSchema,
  reelsExportQuerySchema,
  reelsListQuerySchema,
} from "../../domain/reels/reels.schemas";

const reelsRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

/**
 * GET /api/reels/usage
 * Returns usage stats for the current user.
 */
reelsRouter.get(
  "/usage",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const userId = auth.user.id;

      const [reelsAnalyzedCount, contentGeneratedCount, queueSizeCount] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(featureUsages)
            .where(
              and(
                eq(featureUsages.userId, userId),
                eq(featureUsages.featureType, "reel_analysis"),
              ),
            ),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(generatedContent)
            .where(eq(generatedContent.userId, userId)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(queueItems)
            .where(
              and(
                eq(queueItems.userId, userId),
                eq(queueItems.status, "scheduled"),
              ),
            ),
        ]);

      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return c.json({
        reelsAnalyzed: reelsAnalyzedCount[0]?.count ?? 0,
        reelsAnalyzedLimit: null,
        contentGenerated: contentGeneratedCount[0]?.count ?? 0,
        contentGeneratedLimit: null,
        queueSize: queueSizeCount[0]?.count ?? 0,
        queueLimit: null,
        resetDate: nextMonth.toISOString(),
      });
    } catch (error) {
      debugLog.error("Failed to fetch usage stats", {
        service: "reels-route",
        operation: "getUsage",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch usage stats" }, 500);
    }
  },
);

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
  zValidator("query", reelsListQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const {
        nicheId,
        niche: nicheNameParam = "",
        limit,
        offset,
        minViews,
        sort,
        search,
      } = c.req.valid("query");
      const nicheIdParam = nicheId ? String(nicheId) : undefined;
      const isTrending =
        nicheNameParam.toLowerCase() === "trending" ||
        nicheIdParam === "trending";

      const orderBy =
        sort === "fresh"
          ? [desc(sql`DATE(${reels.scrapedAt})`), desc(reels.views)]
          : sort === "engagement"
            ? [desc(reels.engagementRate)]
            : sort === "recent"
              ? [desc(reels.createdAt)]
              : [desc(reels.views)];

      const conditions: ReturnType<typeof gte>[] = [];
      if (minViews !== undefined) conditions.push(gte(reels.views, minViews));
      if (search) {
        const term = `%${search}%`;
        conditions.push(
          or(
            ilike(reels.username, term),
            ilike(reels.hook, term),
          ) as ReturnType<typeof gte>,
        );
      }

      if (isTrending) {
        conditions.push(
          gte(reels.scrapedAt, sql`NOW() - INTERVAL '7 days'`) as ReturnType<
            typeof gte
          >,
        );
      } else if (nicheId) {
        conditions.push(eq(reels.nicheId, nicheId) as ReturnType<typeof gte>);
      } else if (nicheNameParam) {
        // Resolve name → id via sub-select
        const [matched] = await db
          .select({ id: niches.id })
          .from(niches)
          .where(ilike(niches.name, `%${nicheNameParam}%`))
          .limit(1);
        if (matched)
          conditions.push(
            eq(reels.nicheId, matched.id) as ReturnType<typeof gte>,
          );
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
            thumbnailR2Url: reels.thumbnailR2Url,
            videoR2Url: reels.videoR2Url,
            daysAgo: reels.daysAgo,
            isViral: reels.isViral,
            audioName: reels.audioName,
            createdAt: reels.createdAt,
          })
          .from(reels)
          .where(and(...conditions))
          .orderBy(...orderBy)
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
        nicheId: nicheId ?? null,
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
 * POST /api/reels/bulk
 * Fetch multiple reels by ID in a single request.
 */
reelsRouter.post(
  "/bulk",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("json", bulkReelsSchema, validationErrorHook),
  async (c) => {
    try {
      const { ids } = c.req.valid("json");
      const uniqueIds = Array.from(new Set(ids)).slice(0, 50);

      if (uniqueIds.length === 0) {
        return c.json({ reels: [] });
      }

      const rows = await db
        .select()
        .from(reels)
        .where(inArray(reels.id, uniqueIds));

      const rowById = new Map<number, (typeof rows)[0]>(
        rows.map((row) => [row.id, row]),
      );
      const ordered = uniqueIds
        .map((id: number) => rowById.get(id))
        .filter(Boolean);

      return c.json({ reels: ordered });
    } catch (error) {
      debugLog.error("Failed to fetch reels in bulk", {
        service: "reels-route",
        operation: "bulkReels",
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
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");

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
 * GET /api/reels/:id/media-url
 * Returns a playable video URL — presigned R2 URL if available, else CDN URL.
 */
reelsRouter.get(
  "/:id/media-url",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");

      const [reel] = await db
        .select({ videoR2Url: reels.videoR2Url })
        .from(reels)
        .where(eq(reels.id, id));

      if (!reel) return c.json({ error: "Reel not found" }, 404);

      if (!reel.videoR2Url) return c.json({ error: "No video available" }, 404);

      let url: string | null = null;
      try {
        const rawKey = extractKeyFromUrl(reel.videoR2Url);
        if (rawKey) {
          url = await getFileUrl(rawKey, 3600);
        }
      } catch {
        // signed URL generation failed
      }

      if (!url) return c.json({ error: "No video available" }, 404);
      return c.json({ url });
    } catch (error) {
      debugLog.error("Failed to get media URL", {
        service: "reels-route",
        operation: "getMediaUrl",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to get media URL" }, 500);
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
  usageGate("analysis"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const analysis = await analyzeReel(id, auth.user.id);

      // Track usage after successful analysis
      await recordUsage(
        auth.user.id,
        "reel_analysis",
        { reelId: id },
        { analysisId: analysis.id },
      ).catch(() => {});

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
  zValidator("query", reelsExportQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { nicheId, niche: nicheNameParam, format, minViews } =
        c.req.valid("query");
      const nicheIdParam = nicheId ? String(nicheId) : undefined;

      if (!nicheIdParam && !nicheNameParam) {
        return c.json(
          { error: "nicheId or niche parameter is required for export" },
          400,
        );
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
        .where(
          and(
            gte(
              reels.views,
              minViews !== undefined ? minViews : VIRAL_VIEWS_THRESHOLD,
            ),
            eq(reels.nicheId, resolvedNicheId),
          ),
        )
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
