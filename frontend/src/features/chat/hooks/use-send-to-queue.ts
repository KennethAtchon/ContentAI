import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateQueueQueries } from "@/shared/lib/query-invalidation";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

export function useSendToQueue() {
  const queryClient = useQueryClient();
  const { authenticatedFetch } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async (generatedContentId: number) => {
      const res = await authenticatedFetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedContentId }),
      });
      if (!res.ok) throw new Error("Failed to send to queue");
      return res.json();
    },
    onSuccess: () => {
      void invalidateQueueQueries(queryClient);
    },
  });
}
