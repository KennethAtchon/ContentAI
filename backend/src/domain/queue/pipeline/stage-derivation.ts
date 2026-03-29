export type PipelineStageStatus = "pending" | "running" | "ok" | "failed";

export interface PipelineStage {
  id: string;
  label: string;
  status: PipelineStageStatus;
  error?: string;
}

export function tracksHaveBlockingPlaceholders(tracks: unknown): boolean {
  if (!Array.isArray(tracks)) return false;
  for (const t of tracks as Array<{ type?: string; clips?: unknown[] }>) {
    if (t.type !== "video" || !Array.isArray(t.clips)) continue;
    for (const c of t.clips) {
      const clip = c as {
        isPlaceholder?: boolean;
        placeholderStatus?: string;
      };
      if (
        clip.isPlaceholder &&
        (clip.placeholderStatus === "pending" ||
          clip.placeholderStatus === "generating")
      ) {
        return true;
      }
    }
  }
  return false;
}

export type StageDerivationInput = {
  generatedHook: string | null;
  generatedScript: string | null;
  generatedMetadata: unknown;
  status: string;
  editProjectId?: string | null;
  editProjectTracks?: unknown;
  latestExportStatus?: string | null;
};

export function deriveStages(
  row: StageDerivationInput,
  assetRoleCounts: Record<string, number>,
): PipelineStage[] {
  const meta = (row.generatedMetadata ?? {}) as Record<string, unknown>;
  const phase4 = (meta.phase4 ?? {}) as Record<string, unknown>;
  const phase4Status = phase4.status as string | undefined;
  const contentFailed = row.status === "failed";

  const hasCopy = !!(row.generatedHook || row.generatedScript);
  const hasVoiceover = (assetRoleCounts["voiceover"] ?? 0) > 0;
  const hasVideoClips = (assetRoleCounts["video_clip"] ?? 0) > 0;

  const videoRunning = phase4Status === "running" || phase4Status === "pending";
  const videoFailed = phase4Status === "failed" || contentFailed;

  const hasEditProject = row.editProjectId != null && row.editProjectId !== "";
  const blockingPlaceholders = tracksHaveBlockingPlaceholders(
    row.editProjectTracks,
  );

  let editorReadyStatus: PipelineStageStatus = "pending";
  if (!hasVideoClips) {
    editorReadyStatus = "pending";
  } else if (!hasEditProject) {
    editorReadyStatus = "pending";
  } else if (blockingPlaceholders) {
    editorReadyStatus = "running";
  } else {
    editorReadyStatus = "ok";
  }

  return [
    {
      id: "copy",
      label: "Copy",
      status: hasCopy ? "ok" : "pending",
    },
    {
      id: "voiceover",
      label: "Voiceover",
      status: hasVoiceover ? "ok" : "pending",
    },
    {
      id: "video",
      label: "Video clips",
      status: videoFailed
        ? "failed"
        : videoRunning
          ? "running"
          : hasVideoClips
            ? "ok"
            : "pending",
      error: videoFailed ? (phase4.error as string | undefined) : undefined,
    },
    {
      id: "editor_ready",
      label: "Editor ready",
      status: editorReadyStatus,
    },
    {
      id: "export",
      label: "Export",
      status:
        row.latestExportStatus === "done"
          ? "ok"
          : row.latestExportStatus === "rendering"
            ? "running"
            : row.latestExportStatus === "failed"
              ? "failed"
              : "pending",
    },
  ];
}
