import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import type { CreateReelResponse } from "../types/video.types";

export function useAssembleReel() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: (generatedContentId: number) =>
      authenticatedFetchJson<CreateReelResponse>("/api/video/assemble", {
        method: "POST",
        body: JSON.stringify({ generatedContentId, includeCaptions: true }),
      }),
  });
}
