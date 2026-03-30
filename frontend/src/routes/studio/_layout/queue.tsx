import { createFileRoute } from "@tanstack/react-router";
import { QueueView } from "@/features/studio/components/queue/QueueView";
import { prefetchStudioQueue } from "@/shared/lib/route-data-prefetch";

export const Route = createFileRoute("/studio/_layout/queue")({
  loader: ({ context }) => prefetchStudioQueue(context.queryClient),
  component: QueueView,
});
