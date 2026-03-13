import { CronJob } from "bun";
import { db } from "../services/db/db";
import { niches } from "../infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { queueService } from "../services/queue.service";
import { debugLog } from "../utils/debug/debug";

export function startDailyScan(): void {
  new CronJob("0 3 * * *", async () => {
    try {
      const activeNiches = await db
        .select({ id: niches.id, name: niches.name })
        .from(niches)
        .where(eq(niches.isActive, true));

      for (const niche of activeNiches) {
        await queueService.enqueue(niche.id, niche.name);
        await Bun.sleep(30_000);
      }
    } catch (err) {
      debugLog.error("Daily scan failed", {
        service: "daily-scan",
        operation: "run",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  debugLog.info("Daily scan job scheduled (3 AM)", {
    service: "daily-scan",
    operation: "schedule",
  });
}
