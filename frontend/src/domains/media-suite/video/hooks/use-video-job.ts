import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/app/query/query-keys";
import type { VideoJobResponse } from "../model/video.types";

export function useVideoJob(jobId: string | null) {
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.api.videoJob(jobId ?? ""),
    queryFn: () =>
      authenticatedFetchJson<VideoJobResponse>(`/api/video/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) =>
      query.state.data?.job.status === "completed" ||
      query.state.data?.job.status === "failed"
        ? false
        : 5000,
  });
}
