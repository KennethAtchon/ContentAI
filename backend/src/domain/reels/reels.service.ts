import { getFileUrl, extractKeyFromUrl } from "../../services/storage/r2";
import { runReelAiAnalysis } from "./reel-analysis-run";
import { VIRAL_VIEWS_THRESHOLD } from "../../utils/config/envUtil";
import { AppError, Errors } from "../../utils/errors/app-error";
import type { ICustomerRepository } from "../customer/customer.repository";
import type { IReelsRepository } from "./reels.repository";
import type { z } from "zod";
import type {
  bulkReelsSchema,
  reelsExportQuerySchema,
  reelsListQuerySchema,
} from "./reels.schemas";

type ReelsListQuery = z.infer<typeof reelsListQuerySchema>;
type ReelsExportQuery = z.infer<typeof reelsExportQuerySchema>;
type BulkReelsBody = z.infer<typeof bulkReelsSchema>;

export class ReelsService {
  constructor(
    private readonly reels: IReelsRepository,
    private readonly customer: Pick<ICustomerRepository, "insertFeatureUsage">,
  ) {}

  async getUsageDashboard(userId: string) {
    const counts = await this.reels.getUserReelsUsageCounts(userId);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      reelsAnalyzed: counts.reelAnalysisCount,
      reelsAnalyzedLimit: null,
      contentGenerated: counts.contentGeneratedCount,
      contentGeneratedLimit: null,
      queueSize: counts.scheduledQueueCount,
      queueLimit: null,
      resetDate: nextMonth.toISOString(),
    };
  }

  async listActiveNiches() {
    const rows = await this.reels.listActiveNiches();
    return { niches: rows };
  }

  async listReels(query: ReelsListQuery) {
    const {
      nicheId,
      niche: nicheNameParam = "",
      limit,
      offset,
      minViews,
      sort,
      search,
    } = query;

    const { rows, total } = await this.reels.listReelsPage({
      nicheId,
      nicheNameSearch: nicheNameParam,
      limit,
      offset,
      minViews,
      sort,
      search,
    });

    const reelIds = rows.map((r) => r.id);
    const analyzedIds = new Set(await this.reels.findAnalyzedReelIds(reelIds));

    return {
      reels: rows.map((r) => ({
        ...r,
        hasAnalysis: analyzedIds.has(r.id),
      })),
      total,
      nicheId: nicheId ?? null,
      niche: nicheNameParam,
    };
  }

  async bulkByIds(body: BulkReelsBody) {
    const uniqueIds = Array.from(new Set(body.ids)).slice(0, 50);
    if (uniqueIds.length === 0) return { reels: [] as unknown[] };

    const rows = await this.reels.findReelsByIds(uniqueIds);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const ordered = uniqueIds.map((id) => rowById.get(id)).filter(Boolean);
    return { reels: ordered };
  }

  async getReelWithAnalysis(id: number) {
    const reel = await this.reels.findReelById(id);
    if (!reel) throw Errors.notFound("Reel");
    const analysis = await this.reels.findAnalysisByReelId(id);
    return { reel, analysis };
  }

  async getPlayableMediaUrl(id: number) {
    const reel = await this.reels.findVideoR2UrlForReel(id);
    if (!reel) throw Errors.notFound("Reel");
    if (!reel.videoR2Url) {
      throw new AppError("No video available", "NOT_FOUND", 404);
    }

    let url: string | null = null;
    try {
      const rawKey = extractKeyFromUrl(reel.videoR2Url);
      if (rawKey) url = await getFileUrl(rawKey, 3600);
    } catch {
      /* presign failed */
    }

    if (!url) {
      throw new AppError("No video available", "NOT_FOUND", 404);
    }
    return { url };
  }

  async analyzeReelForUser(reelId: number, userId: string) {
    const analysis = await runReelAiAnalysis(this.reels, reelId, userId);
    await this.customer
      .insertFeatureUsage({
        userId,
        featureType: "reel_analysis",
        inputData: { reelId },
        resultData: { analysisId: analysis.id },
      })
      .catch(() => {});
    return { analysis };
  }

  /** Post-scrape pipeline (no usage ledger — system-triggered). */
  async runBackgroundReelAnalysis(reelId: number) {
    return runReelAiAnalysis(this.reels, reelId, undefined);
  }

  /**
   * JSON body for `format: "json"`; caller turns CSV into `Response`.
   */
  async buildExportPayload(query: ReelsExportQuery): Promise<
    | {
        kind: "json";
        body: {
          nicheId: number;
          generatedAt: string;
          totalReels: number;
          avgEngagementRate: number;
          topReels: Array<Record<string, unknown>>;
        };
      }
    | { kind: "csv"; csv: string; nicheId: number }
    | { kind: "error"; status: number; message: string }
  > {
    const { nicheId, niche: nicheNameParam, format, minViews } = query;
    const nicheIdParam = nicheId ? String(nicheId) : undefined;

    if (!nicheIdParam && !nicheNameParam) {
      return {
        kind: "error",
        status: 400,
        message: "nicheId or niche parameter is required for export",
      };
    }

    let resolvedNicheId: number | null = null;
    if (nicheIdParam) {
      resolvedNicheId = Number.parseInt(nicheIdParam, 10);
    } else if (nicheNameParam) {
      resolvedNicheId = await this.reels.findNicheIdByNameIlike(nicheNameParam);
    }

    if (!resolvedNicheId) {
      return { kind: "error", status: 404, message: "No matching niche found" };
    }

    const threshold = minViews !== undefined ? minViews : VIRAL_VIEWS_THRESHOLD;
    const reelRows = await this.reels.findViralReelsForNiche(
      resolvedNicheId,
      threshold,
    );

    if (reelRows.length === 0) {
      return {
        kind: "error",
        status: 404,
        message: "No reels found to export for this niche",
      };
    }

    const reelIds = reelRows.map((r) => r.id);
    const analysisRows = await this.reels.findAnalysesForReelIds(reelIds);
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
      return { kind: "csv", csv, nicheId: resolvedNicheId };
    }

    return {
      kind: "json",
      body: {
        nicheId: resolvedNicheId,
        generatedAt: new Date().toISOString(),
        totalReels: exportData.length,
        avgEngagementRate,
        topReels: exportData,
      },
    };
  }
}
