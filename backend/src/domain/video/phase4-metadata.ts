import type { VideoRouteOwnedContent } from "../content/content.repository";
import { contentService } from "../singletons";

export type { VideoRouteOwnedContent };

export async function fetchOwnedContent(
  userId: string,
  generatedContentId: number,
): Promise<VideoRouteOwnedContent | null> {
  return contentService.fetchOwnedContentForVideo(userId, generatedContentId);
}

export function getPhase4AssemblyFromMetadata(metadata: unknown): {
  jobId: string;
  status: string;
} | null {
  const root = metadata as Record<string, unknown> | null | undefined;
  const phase4 = root?.phase4 as Record<string, unknown> | undefined;
  const assembly = phase4?.assembly as Record<string, unknown> | undefined;
  if (!assembly) return null;
  const jobId = assembly.jobId;
  const status = assembly.status;
  if (typeof jobId !== "string" || typeof status !== "string") return null;
  return { jobId, status };
}

export async function updatePhase4Metadata(input: {
  generatedContentId: number;
  existingGeneratedMetadata: Record<string, unknown> | null;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  shots?: Array<{
    shotIndex: number;
    description: string;
    durationMs: number;
    assetId: string;
    useClipAudio: boolean;
  }>;
  provider?: string;
}) {
  return contentService.updatePhase4Metadata(input);
}
