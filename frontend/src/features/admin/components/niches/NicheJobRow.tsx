import { Badge } from "@/shared/components/ui/badge";
import { type ScrapeJob } from "@/features/admin/hooks/use-niches";
import { cn } from "@/shared/utils/helpers/utils";

// ── Job Row ───────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<ScrapeJob["status"], string> = {
  queued: "bg-overlay-md text-dim-2 border-transparent",
  running: "bg-blue-500/20 text-blue-400 border-transparent",
  completed: "bg-success/20 text-success border-transparent",
  failed: "bg-error/20 text-error border-transparent",
};

export function NicheJobRow({ job }: { job: ScrapeJob }) {
  const created = new Date(job.createdAt);
  const durationMs = job.result?.durationMs;

  return (
    <div className="px-4 py-3 grid grid-cols-[140px_90px_100px_80px_80px_1fr] items-center gap-2 border-b border-overlay-xs last:border-0">
      <span className="text-sm text-dim-2 font-mono truncate">{job.id}</span>
      <Badge className={cn("text-sm w-fit", STATUS_CLASS[job.status])}>
        {job.status}
      </Badge>
      <span className="text-sm text-dim-2">
        {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {" · "}
        {created.toLocaleDateString([], { month: "short", day: "numeric" })}
      </span>
      <span className="text-sm text-dim-1 tabular-nums">
        {job.result ? `+${job.result.saved}` : job.startedAt ? "…" : "—"}
      </span>
      <span className="text-sm text-dim-2 tabular-nums">
        {durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
      </span>
      {job.error ? (
        <span className="text-sm text-error truncate" title={job.error}>
          {job.error}
        </span>
      ) : job.result ? (
        <span className="text-sm text-dim-3">{job.result.skipped} skipped</span>
      ) : (
        <span />
      )}
    </div>
  );
}
