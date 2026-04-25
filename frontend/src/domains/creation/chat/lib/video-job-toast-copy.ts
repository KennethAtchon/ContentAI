import type { VideoJobResponse } from "@/domains/video/model/video.types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Description line for the in-progress reel video toast (shot progress or generic). */
export function reelGeneratingToastDescription(
  videoJobData: VideoJobResponse | undefined,
  t: Translate
): string {
  const progress = videoJobData?.job.progress;
  const { shotsCompleted, totalShots } = progress ?? {};
  if (
    shotsCompleted !== undefined &&
    totalShots !== undefined &&
    totalShots > 0
  ) {
    return t("workspace_video_generating_toast_shot_progress", {
      completed: shotsCompleted,
      total: totalShots,
    });
  }
  return t("workspace_video_generating_toast_description");
}
