import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

type AssembleReelArgs = {
  generatedContentId: number;
  includeCaptions?: boolean;
  audioMix?: {
    includeClipAudio?: boolean;
    clipAudioVolume?: number;
    voiceoverVolume?: number;
    musicVolume?: number;
  };
};

export function useAssembleReel() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ generatedContentId, includeCaptions = true, audioMix }: AssembleReelArgs) =>
      authenticatedFetchJson<{ editorProjectId: string; redirectUrl: string }>(
        "/api/video/assemble",
        {
          method: "POST",
          body: JSON.stringify({ generatedContentId, includeCaptions, audioMix }),
        },
      ),
    onSuccess: (_data, variables) => {
      void navigate({
        to: "/studio/editor",
        search: { contentId: variables.generatedContentId },
      });
    },
  });
}
