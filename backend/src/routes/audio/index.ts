import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  reels,
  trendingAudio,
} from "../../infrastructure/database/drizzle/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";

const audioRouter = new Hono<HonoEnv>();

/**
 * GET /api/audio/trending
 * Returns trending audio usage within a time window.
 */
audioRouter.get(
  "/trending",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const days = Math.min(parseInt(c.req.query("days") ?? "7", 10), 90);
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
      const nicheIdParam = c.req.query("nicheId");
      const nicheId = nicheIdParam ? parseInt(nicheIdParam, 10) : null;

      const startWindow = sql.raw(`NOW() - INTERVAL '${days} days'`);
      const prevWindow = sql.raw(`NOW() - INTERVAL '${days * 2} days'`);

      const conditions = [
        sql`${reels.audioId} is not null`,
        sql`${reels.audioName} is not null`,
        gte(reels.scrapedAt, prevWindow),
      ];

      if (nicheId && !Number.isNaN(nicheId)) {
        conditions.push(eq(reels.nicheId, nicheId));
      }

      const rows = await db
        .select({
          audioId: reels.audioId,
          audioName: reels.audioName,
          artistName: trendingAudio.artistName,
          useCount: sql<number>`sum(case when ${reels.scrapedAt} >= ${startWindow} then 1 else 0 end)::int`,
          prevCount: sql<number>`sum(case when ${reels.scrapedAt} < ${startWindow} then 1 else 0 end)::int`,
          lastSeen: sql<string>`max(${reels.scrapedAt})::text`,
        })
        .from(reels)
        .leftJoin(trendingAudio, eq(trendingAudio.audioId, reels.audioId))
        .where(and(...conditions))
        .groupBy(reels.audioId, reels.audioName, trendingAudio.artistName)
        .orderBy(
          desc(
            sql`sum(case when ${reels.scrapedAt} >= ${startWindow} then 1 else 0 end)`,
          ),
        )
        .limit(limit);

      const audio = rows.map((row) => {
        const current = row.useCount ?? 0;
        const previous = row.prevCount ?? 0;
        const trend =
          current > previous
            ? "rising"
            : current < previous
              ? "declining"
              : "stable";

        return {
          audioId: row.audioId,
          audioName: row.audioName,
          artistName: row.artistName,
          useCount: current,
          lastSeen: row.lastSeen,
          trend,
        };
      });

      return c.json({ audio });
    } catch (error) {
      debugLog.error("Failed to fetch trending audio", {
        service: "audio-route",
        operation: "getTrending",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch trending audio" }, 500);
    }
  },
);

export default audioRouter;
