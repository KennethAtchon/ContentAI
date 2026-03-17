import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type {
  ApiEnvelope,
  CompositionMode,
  Timeline,
} from "../types/composition.types";

type SaveCompositionArgs = {
  compositionId: string;
  expectedVersion: number;
  editMode: CompositionMode;
  timeline: Timeline;
};

type SaveCompositionResponse = {
  compositionId: string;
  saved: boolean;
  version: number;
  updatedAt: string;
};

export function useSaveComposition() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      compositionId,
      expectedVersion,
      editMode,
      timeline,
    }: SaveCompositionArgs): Promise<SaveCompositionResponse> => {
      const res =
        await authenticatedFetchJson<ApiEnvelope<SaveCompositionResponse>>(
          `/api/video/compositions/${compositionId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              expectedVersion,
              editMode,
              timeline,
            }),
          },
        );

      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoComposition(variables.compositionId),
      });
    },
  });
}
