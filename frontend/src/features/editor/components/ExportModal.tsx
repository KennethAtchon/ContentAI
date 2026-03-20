import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { ExportJobStatus } from "../types/editor";

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ExportModal({ projectId, onClose }: Props) {
  const { t } = useTranslation();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const fetcher = useQueryFetcher<ExportJobStatus>();
  const [resolution, setResolution] = useState<"720p" | "1080p" | "4k">(
    "1080p"
  );
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [jobId, setJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: enqueue, isPending } = useMutation({
    mutationFn: () =>
      authenticatedFetchJson<{ exportJobId: string }>(
        `/api/editor/${projectId}/export`,
        {
          method: "POST",
          body: JSON.stringify({ resolution, fps }),
        }
      ),
    onSuccess: (data) => setJobId(data.exportJobId),
  });

  const { data: statusData } = useQuery({
    queryKey: queryKeys.api.editorExportStatus(projectId),
    queryFn: () => fetcher(`/api/editor/${projectId}/export/status`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "done" || status === "failed") return false;
      return 3000;
    },
  });

  const status = statusData?.status ?? "idle";
  const progress = statusData?.progress ?? 0;
  const r2Url = statusData?.r2Url;
  const exportError = statusData?.error;

  const handleCopy = async () => {
    if (!r2Url) return;
    await navigator.clipboard.writeText(r2Url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRendering = status === "queued" || status === "rendering";
  const isDone = status === "done";
  const isFailed = status === "failed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-studio-surface border border-overlay-md rounded-xl shadow-2xl w-[420px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-dim-1">
            {t("editor_export_modal_title")}
          </h2>
          <button
            onClick={onClose}
            className="transport-btn"
          >
            <X size={15} />
          </button>
        </div>

        {!jobId ? (
          <>
            {/* Export options */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs text-dim-2 mb-1.5">
                  Resolution
                </label>
                <div className="flex gap-2">
                  {(["720p", "1080p", "4k"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={cn(
                        "flex-1 py-1.5 text-xs rounded border cursor-pointer transition-colors",
                        resolution === r
                          ? "border-studio-accent bg-studio-accent/10 text-studio-accent"
                          : "border-overlay-md bg-overlay-sm text-dim-2 hover:text-dim-1"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-dim-2 mb-1.5">
                  Frame Rate
                </label>
                <div className="flex gap-2">
                  {([24, 30, 60] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={cn(
                        "flex-1 py-1.5 text-xs rounded border cursor-pointer transition-colors",
                        fps === f
                          ? "border-studio-accent bg-studio-accent/10 text-studio-accent"
                          : "border-overlay-md bg-overlay-sm text-dim-2 hover:text-dim-1"
                      )}
                    >
                      {f} fps
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => enqueue()}
              disabled={isPending}
              className={cn(
                "w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity",
                "bg-gradient-to-br from-studio-accent to-studio-purple text-white border-0 cursor-pointer",
                isPending ? "opacity-60" : "hover:opacity-90"
              )}
            >
              {isPending ? "Starting…" : t("editor_export_button")}
            </button>
          </>
        ) : (
          <>
            {/* Render progress */}
            {isRendering && (
              <div className="space-y-3">
                <p className="text-sm text-dim-2">
                  {t("editor_export_rendering")}
                </p>
                <div className="w-full h-2 bg-overlay-sm rounded-full overflow-hidden">
                  <div
                    className="h-full bg-studio-accent transition-all duration-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-dim-3 text-right">{progress}%</p>
              </div>
            )}

            {/* Done */}
            {isDone && r2Url && (
              <div className="space-y-3">
                <p className="text-sm text-green-400">
                  {t("editor_export_done")}
                </p>
                <div className="flex gap-2">
                  <a
                    href={r2Url}
                    download
                    className="flex-1 py-2 text-xs text-center rounded border border-overlay-md bg-overlay-sm text-dim-1 hover:text-dim-2 no-underline transition-colors"
                  >
                    {t("editor_export_download")}
                  </a>
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-2 text-xs rounded border border-overlay-md bg-overlay-sm text-dim-1 hover:text-dim-2 cursor-pointer transition-colors"
                  >
                    {copied ? "Copied!" : t("editor_export_copy_url")}
                  </button>
                </div>
              </div>
            )}

            {/* Failed */}
            {isFailed && (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  {t("editor_export_failed")}
                </p>
                {exportError && (
                  <p className="text-xs text-dim-3 font-mono bg-overlay-sm p-2 rounded">
                    {exportError}
                  </p>
                )}
                <button
                  onClick={() => setJobId(null)}
                  className="text-xs text-studio-accent hover:underline bg-transparent border-0 cursor-pointer"
                >
                  Try again
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
