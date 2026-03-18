import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Timeline } from "../../types/composition.types";
import { useCompositionJob } from "../../hooks/use-composition-job";
import { useCompositionVersions } from "../../hooks/use-composition-versions";
import { useRetryCompositionJob } from "../../hooks/use-retry-composition-job";
import { useTriggerRender } from "../../hooks/use-trigger-render";
import { useValidateTimeline } from "../../hooks/use-validate-timeline";
import { ValidationFeedback } from "./ValidationFeedback";

export type RenderPanelProps = {
  compositionId: string;
  version: number;
  timeline: Timeline;
};

export function RenderPanel({
  compositionId,
  version,
  timeline,
}: RenderPanelProps) {
  const { t } = useTranslation();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const validateTimeline = useValidateTimeline();
  const triggerRender = useTriggerRender();
  const retryRender = useRetryCompositionJob();
  const compositionJob = useCompositionJob(currentJobId);
  const versions = useCompositionVersions(compositionId);

  const validationIssues = useMemo(
    () => validateTimeline.data?.issues ?? [],
    [validateTimeline.data],
  );
  const jobStatusLabel = useMemo(() => {
    const status = compositionJob.data?.status;
    if (!status) return t("phase5_editor_status_idle");
    if (status === "queued") return t("phase5_editor_status_queued");
    if (status === "rendering") return t("phase5_editor_status_rendering");
    if (status === "completed") return t("phase5_editor_status_completed");
    return t("phase5_editor_status_failed");
  }, [compositionJob.data?.status, t]);
  const progressPhaseLabel = useMemo(() => {
    const phase = compositionJob.data?.progress?.phase;
    if (!phase) return null;
    return t(`phase5_editor_progress_phase_${phase}`);
  }, [compositionJob.data?.progress?.phase, t]);

  const handleValidate = async () => {
    await validateTimeline.mutateAsync({ compositionId, timeline });
  };

  const handleRender = async () => {
    const result = await triggerRender.mutateAsync({
      compositionId,
      expectedVersion: version,
      includeCaptions: true,
    });
    setCurrentJobId(result.jobId);
  };

  const handleRetry = async () => {
    if (!currentJobId) return;
    const result = await retryRender.mutateAsync(currentJobId);
    setCurrentJobId(result.jobId);
  };

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_render")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => void handleValidate()}
          disabled={validateTimeline.isPending}
          className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        >
          {validateTimeline.isPending
            ? t("phase5_editor_validating")
            : t("phase5_editor_validate")}
        </button>
        <button
          onClick={() => void handleRender()}
          disabled={triggerRender.isPending}
          className="min-h-9 rounded border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          {triggerRender.isPending
            ? t("phase5_editor_rendering")
            : t("phase5_editor_render_now")}
        </button>
        {compositionJob.data?.status === "failed" && (
          <button
            onClick={() => void handleRetry()}
            disabled={retryRender.isPending}
            className="min-h-9 rounded border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          >
            {retryRender.isPending
              ? t("phase5_editor_retrying")
              : t("phase5_editor_retry")}
          </button>
        )}
      </div>

      <div className="mt-3 rounded border border-border/60 bg-muted/20 p-2.5">
        <ValidationFeedback issues={validationIssues} />
      </div>

      {compositionJob.data && (
        <div className="mt-3 rounded border border-border/60 bg-muted/20 p-2.5 text-[11px] text-foreground/80">
          <p>
            {t("phase5_editor_job_status", { status: jobStatusLabel })}
          </p>
          {compositionJob.data.progress ? (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-muted-foreground">
                {t("phase5_editor_progress_label", {
                  phase: progressPhaseLabel ?? compositionJob.data.progress.phase,
                  percent: Math.round(compositionJob.data.progress.percent),
                })}
              </p>
              <div className="h-1.5 overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-emerald-400/80"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(compositionJob.data.progress.percent, 100),
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          {compositionJob.data.result?.videoUrl && (
            <a
              href={compositionJob.data.result.videoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block text-blue-300 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              {t("phase5_editor_open_render")}
            </a>
          )}
          {compositionJob.data.error?.message && (
            <p className="mt-1 text-red-300">{compositionJob.data.error.message}</p>
          )}
        </div>
      )}

      <div className="mt-3 rounded border border-border/60 bg-muted/20 p-2.5">
        <p className="text-[11px] font-medium text-foreground/80">
          {t("phase5_editor_versions")}
        </p>
        <div className="mt-1 space-y-1">
          {versions.data?.items.length ? (
            versions.data.items.slice(0, 4).map((item) => (
              <p key={item.assetId} className="text-[11px] text-muted-foreground">
                {item.label}
              </p>
            ))
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {t("phase5_editor_versions_empty")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
