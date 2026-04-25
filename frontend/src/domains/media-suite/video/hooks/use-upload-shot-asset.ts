import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { invalidateContentAssetsForGeneration } from "@/app/query/query-invalidation";

type UploadShotAssetArgs = {
  generatedContentId: number;
  shotIndex: number;
  file: File;
};

export function useUploadShotAsset() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      generatedContentId,
      shotIndex,
      file,
    }: UploadShotAssetArgs) => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("generatedContentId", String(generatedContentId));
      formData.set("shotIndex", String(shotIndex));
      formData.set(
        "assetType",
        file.type.toLowerCase().startsWith("video/") ? "video_clip" : "image"
      );

      const response = await authenticatedFetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to upload shot asset");
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        variables.generatedContentId
      );
    },
  });
}
