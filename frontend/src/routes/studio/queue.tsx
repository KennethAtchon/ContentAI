import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { QueueView } from "@/features/studio/components/queue/QueueView";

export const Route = createFileRoute("/studio/queue")({
  component: QueuePage,
});

function QueuePage() {
  return (
    <AuthGuard authType="user">
      <QueueView />
    </AuthGuard>
  );
}
