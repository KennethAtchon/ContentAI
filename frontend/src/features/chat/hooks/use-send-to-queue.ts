import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateQueueQueries } from "@/shared/lib/query-invalidation";
import { chatService } from "../services/chat.service";

export function useSendToQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (generatedContentId: number) =>
      chatService.addToQueue(generatedContentId),
    onSuccess: () => {
      void invalidateQueueQueries(queryClient);
    },
  });
}
