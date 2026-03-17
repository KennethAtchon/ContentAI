import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import type {
  ApiEnvelope,
  CompositionIssue,
  Timeline,
} from "../types/composition.types";

type ValidateTimelineArgs = {
  compositionId: string;
  timeline: Timeline;
};

type ValidateTimelineResponse = {
  valid: boolean;
  issues: CompositionIssue[];
};

export function useValidateTimeline() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async ({
      compositionId,
      timeline,
    }: ValidateTimelineArgs): Promise<ValidateTimelineResponse> => {
      const res =
        await authenticatedFetchJson<ApiEnvelope<ValidateTimelineResponse>>(
          `/api/video/compositions/${compositionId}/validate`,
          {
            method: "POST",
            body: JSON.stringify({ timeline }),
          },
        );
      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}
