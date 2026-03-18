import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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

export function RenderPanel({ compositionId, version, timeline }: RenderPanelProps) {
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

  const jobStatus = compositionJob.data?.status;
  const jobStatusLabel = useMemo(() => {
    if (!jobStatus) return t("phase5_editor_status_idle");
    if (jobStatus === "queued") return t("phase5_editor_status_queued");
    if (jobStatus === "rendering") return t("phase5_editor_status_rendering");
    if (jobStatus === "completed") return t("phase5_editor_status_completed");
    return t("phase5_editor_status_failed");
  }, [jobStatus, t]);

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

  const isRendering = jobStatus === "queued" || jobStatus === "rendering";

  return (
    // No outer border box — flat panel section
    <div>
      {/* Export header */}
      <div className="px-3 py-2.5 border-b border-overlay-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dim-3">
          {t("phase5_editor_render")}
        </p>
      </div>

      {/* Actions */}
      <div className="px-3 py-3 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => void handleValidate()}
            disabled={validateTimeline.isPending}
            className="flex-1 py-1.5 rounded border border-overlay-md bg-overlay-xs text-[10px] font-medium text-dim-2 hover:text-dim-1 hover:bg-overlay-sm disabled:opacity-40 transition-colors"
          >
            {validateTimeline.isPending ? t("phase5_editor_validating") : t("phase5_editor_validate")}
          </button>
          <button
            onClick={() => void handleRender()}
            disabled={triggerRender.isPending || isRendering}
            className="flex-1 py-1.5 rounded border border-success/30 bg-success/10 text-[10px] font-semibold text-success/80 hover:bg-success/18 hover:text-success disabled:opacity-40 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {(triggerRender.isPending || isRendering) && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {triggerRender.isPending || isRendering
              ? t("phase5_editor_rendering")
              : t("phase5_editor_render_now")}
          </button>
        </div>

        {/* Retry on failure */}
        {jobStatus === "failed" && (
          <button
            onClick={() => void handleRetry()}
            disabled={retryRender.isPending}
            className="w-full py-1.5 rounded border border-error/25 bg-error/8 text-[10px] font-medium text-error/70 hover:bg-error/15 disabled:opacity-40 transition-colors"
          >
            {retryRender.isPending ? t("phase5_editor_retrying") : t("phase5_editor_retry")}
          </button>
        )}

        {/* Validation issues */}
        {validateTimeline.data && (
          <div className="text-[10px]">
            <ValidationFeedback issues={validationIssues} />
          </div>
        )}

        {/* Job progress */}
        {compositionJob.data && (
          <div className="space-y-2 text-[10px] text-dim-2">
            <div className="flex items-center justify-between">
              <span>{t("phase5_editor_job_status", { status: jobStatusLabel })}</span>
              {compositionJob.data.progress && (
                <span className="tabular-nums text-dim-3">
                  {Math.round(compositionJob.data.progress.percent)}%
                </span>
              )}
            </div>
            {compositionJob.data.progress && (
              <>
                <div className="h-1 rounded-full bg-overlay-md overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success/70 transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(compositionJob.data.progress.percent, 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[9px] text-dim-3">
                  {progressPhaseLabel ?? compositionJob.data.progress.phase}
                </p>
              </>
            )}
            {compositionJob.data.result?.videoUrl && (
              <a
                href={compositionJob.data.result.videoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-300/70 hover:text-blue-200 hover:underline transition-colors"
              >
                {t("phase5_editor_open_render")} ↗
              </a>
            )}
            {compositionJob.data.error?.message && (
              <p className="text-error/70">{compositionJob.data.error.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Version history */}
      <div className="border-t border-overlay-sm px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-dim-3 mb-2">
          {t("phase5_editor_versions")}
        </p>
        <div className="space-y-1">
          {versions.data?.items.length ? (
            versions.data.items.slice(0, 3).map((item) => (
              <p key={item.assetId} className="text-[9px] text-dim-3 truncate">
                {item.label}
              </p>
            ))
          ) : (
            <p className="text-[9px] text-dim-3">{t("phase5_editor_versions_empty")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
