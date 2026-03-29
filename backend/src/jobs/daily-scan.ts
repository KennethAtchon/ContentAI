import { adminRepository } from "../domain/singletons";
import { queueService } from "../services/queue.service";
import { debugLog } from "../utils/debug/debug";

const ONE_DAY_MS = 86_400_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDailyScan(): Promise<void> {
  try {
    const activeNiches = await adminRepository.listActiveNichesForDailyScan();

    for (const niche of activeNiches) {
      await queueService.enqueue(niche.id, niche.name);
      await sleep(30_000);
    }
  } catch (err) {
    debugLog.error("Daily scan failed", {
      service: "daily-scan",
      operation: "run",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startDailyScan(): void {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const initialDelay = next.getTime() - now.getTime();
  setTimeout(() => {
    void runDailyScan();
    setInterval(() => void runDailyScan(), ONE_DAY_MS);
  }, initialDelay);

  debugLog.info("Daily scan job scheduled (3 AM)", {
    service: "daily-scan",
    operation: "schedule",
  });
}
