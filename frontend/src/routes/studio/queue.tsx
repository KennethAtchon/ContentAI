import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { QueueView } from "@/features/studio/components/queue/QueueView";
import { prefetchStudioQueue } from "@/shared/lib/route-data-prefetch";

export const Route = createFileRoute("/studio/queue")({
  loader: ({ context }) => prefetchStudioQueue(context.queryClient),
  component: QueuePage,
});

function QueuePage() {
  return (
    <AuthGuard authType="user">
      <QueueView />
    </AuthGuard>
  );
}
