import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { EditorStore } from "./useEditorStore";

interface RegenerateInEditorArgs {
  generatedContentId: number;
  shotIndex: number;
  prompt: string;
  clipId: string;
}

interface VideoJobResponse {
  status: string;
  result?: { clipAssetId?: string };
}

export function useRegenerateShotInEditor(editorStore: EditorStore) {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const fetcher = useQueryFetcher<{ job: VideoJobResponse }>();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  // Poll for job completion every 2s
  useQuery({
    queryKey: queryKeys.api.videoJob(activeJobId ?? ""),
    queryFn: () => fetcher(`/api/video/jobs/${activeJobId}`),
    enabled: !!activeJobId,
    refetchInterval: 2000,
    select: (data) => {
      const job = data.job;
      if (
        job.status === "completed" &&
        job.result?.clipAssetId &&
        activeClipId
      ) {
        editorStore.updateClip(activeClipId, {
          assetId: job.result.clipAssetId,
        });
        setActiveJobId(null);
        setActiveClipId(null);
      }
      if (job.status === "failed") {
        setActiveJobId(null);
        setActiveClipId(null);
      }
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({
      generatedContentId,
      shotIndex,
      prompt,
      clipId,
    }: RegenerateInEditorArgs) => {
      const result = await authenticatedFetchJson<{ jobId: string }>(
        "/api/video/shots/regenerate",
        {
          method: "POST",
          body: JSON.stringify({ generatedContentId, shotIndex, prompt }),
        }
      );
      setActiveJobId(result.jobId);
      setActiveClipId(clipId);
      return result;
    },
  });

  return {
    regenerate: mutation.mutate,
    isRegenerating: mutation.isPending || !!activeJobId,
    activeClipId,
  };
}
