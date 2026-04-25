import { useTranslation } from "react-i18next";
import { type ScrapeJob } from "@/domains/admin/hooks/use-niches";

// ── Scan Status Banner ────────────────────────────────────────────────────────

export function NicheScanStatusBanner({ job }: { job: ScrapeJob }) {
  const { t } = useTranslation();

  if (job.status === "completed") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-success">
        <span className="h-2 w-2 rounded-full bg-success shrink-0" />
        <span className="text-base font-medium">
          {t("admin_niche_scan_complete", {
            saved: job.result?.saved ?? 0,
            skipped: job.result?.skipped
              ? t("admin_niche_skipped", { count: job.result.skipped })
              : "",
            duration: job.result?.durationMs
              ? t("admin_niche_duration_suffix", {
                  seconds: (job.result.durationMs / 1000).toFixed(1),
                })
              : "",
          })}
        </span>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error">
        <span className="h-2 w-2 rounded-full bg-error shrink-0" />
        <span className="text-base font-medium">
          {t("admin_niche_scan_failed")}
          {job.error ? `: ${job.error}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
      </span>
      <span className="text-base font-medium">
        {job.status === "queued"
          ? t("admin_niche_scan_queued")
          : t("admin_niche_scraping")}
      </span>
    </div>
  );
}
