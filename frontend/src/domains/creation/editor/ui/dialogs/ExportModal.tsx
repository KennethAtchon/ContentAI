import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/primitives/dialog";
import { useEffect, useRef, useState } from "react";
import type { ExportJobStatus } from "../../model/editor-domain";
import { editorApi } from "../../bridge/editor-api";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorUIStore } from "../../store/editor-ui-store";
import { ResolutionPicker } from "./ResolutionPicker";

const POLL_MS = 2000;

// TODO: This export modal should first check if the project can be exported only using the user's browser client side, if not it relies on the server, dont default to the server
export function ExportModal() {
  const exportModalOpen = useEditorUIStore((state) => state.exportModalOpen);
  const exportJobId = useEditorUIStore((state) => state.exportJobId);
  const closeExportModal = useEditorUIStore((state) => state.closeExportModal);
  const setExportJob = useEditorUIStore((state) => state.setExportJob);
  const setExportStatus = useEditorUIStore((state) => state.setExportStatus);
  const projectId = useEditorProjectStore((state) => state.editProjectId);
  const defaultResolution = useEditorProjectStore((state) => state.resolution);
  const defaultFps = useEditorProjectStore((state) => state.fps);

  const [resolution, setResolution] = useState(defaultResolution);
  const [fps, setFps] = useState(defaultFps);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportState, setLocalExportState] = useState<ExportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!exportModalOpen) return;
    setResolution(defaultResolution);
    setFps(defaultFps);
  }, [defaultFps, defaultResolution, exportModalOpen]);

  useEffect(() => {
    setExportStatus(exportState);
  }, [exportState, setExportStatus]);

  useEffect(() => {
    const isActive =
      exportState?.status === "queued" || exportState?.status === "rendering";

    if (!projectId || !isActive) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) {
      clearInterval(pollRef.current);
    }

    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const status = await editorApi.getExportStatus(projectId);
          setLocalExportState(status);
          if (status.status === "done" || status.status === "failed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {
          // Keep polling; transient export-status errors should not close the dialog.
        }
      })();
    }, POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [exportState?.status, projectId]);

  async function handleStartExport() {
    if (!projectId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await editorApi.startExport(projectId, { resolution, fps });
      setExportJob(result.exportJobId);
      setLocalExportState({
        status: "queued",
        progress: 0,
        projectRevisionId: result.projectRevisionId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    const isActive =
      exportState?.status === "queued" || exportState?.status === "rendering";
    if (isActive) return;

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setLocalExportState(null);
    setError(null);
    setExportJob(null);
    closeExportModal();
  }

  const isActive =
    exportState?.status === "queued" || exportState?.status === "rendering";
  const isDone = exportState?.status === "done";
  const isFailed = exportState?.status === "failed";

  return (
    <Dialog open={exportModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        {!isActive && !isDone && !isFailed && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-dim-2">Resolution</span>
              <ResolutionPicker
                resolution={resolution}
                onChange={setResolution}
              />
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-dim-2">Frame Rate</span>
              <select
                value={String(fps)}
                onChange={(event) => setFps(Number(event.target.value))}
                className="h-9 rounded border border-overlay-md bg-transparent px-3 text-sm text-dim-1 outline-none"
              >
                {[24, 25, 30, 60].map((value) => (
                  <option
                    key={value}
                    value={value}
                    className="bg-studio-surface text-dim-1"
                  >
                    {value} fps
                  </option>
                ))}
              </select>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleStartExport}
              disabled={isSubmitting || !projectId}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-4 py-2 rounded-lg border-0 disabled:opacity-50"
            >
              {isSubmitting ? "Starting…" : "Export"}
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-dim-2">
              {exportState?.progressPhase ?? "Rendering…"}
            </p>
            <div className="h-2 bg-overlay-sm rounded-full overflow-hidden">
              <div
                className="h-full bg-studio-accent transition-all"
                style={{ width: `${exportState?.progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-dim-3">
              Job {exportJobId ?? "pending"} · {Math.round(exportState?.progress ?? 0)}%
            </p>
          </div>
        )}

        {isDone && exportState?.r2Url && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-green-400">Export complete.</p>
            <a
              href={exportState.r2Url}
              download
              className="text-studio-accent underline text-sm"
            >
              Download video
            </a>
          </div>
        )}

        {isFailed && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-red-400">
              {exportState?.error ?? "Export failed."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
