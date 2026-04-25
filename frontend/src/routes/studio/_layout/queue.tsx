import { createFileRoute } from "@tanstack/react-router";
import { QueueView } from "@/domains/studio/ui/queue/QueueView";
import { prefetchStudioQueue } from "@/app/query/route-data-prefetch";

export const Route = createFileRoute("/studio/_layout/queue")({
  loader: ({ context }) => prefetchStudioQueue(context.queryClient),
  component: QueueView,
});
