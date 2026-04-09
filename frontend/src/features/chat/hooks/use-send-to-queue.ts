import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateQueueQueries } from "@/shared/lib/query-invalidation";
import { chatService } from "../services/chat.service";

export function useSendToQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (generatedContentId: number) =>
      chatService.addToQueue(generatedContentId),
    onSuccess: () => {
      void invalidateQueueQueries(queryClient);
      toast.success("Added to queue");
    },
    onError: () => {
      toast.error("Failed to add this draft to the queue");
    },
  });
}
