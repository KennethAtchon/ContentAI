import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type {
  ApiEnvelope,
  CompositionRenderJob,
} from "../types/composition.types";

type CompositionJobData = {
  jobId: string;
  status: "queued" | "rendering" | "completed";
  progress?: CompositionRenderJob["progress"];
  result?: CompositionRenderJob["result"];
};

export function useCompositionJob(jobId: string | null) {
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.api.videoCompositionJob(jobId ?? ""),
    queryFn: async (): Promise<CompositionRenderJob> => {
      const res = await authenticatedFetchJson<
        ApiEnvelope<CompositionJobData>
      >(`/api/video/composition-jobs/${jobId}`);

      if (res.ok) {
        return {
          jobId: res.data.jobId,
          status: res.data.status,
          progress: res.data.progress,
          result: res.data.result,
        };
      }

      return {
        jobId,
        status: "failed",
        error: res.error,
      };
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "completed" || status === "failed") {
        return false;
      }
      return 2500;
    },
  });
}
