import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionsView } from "@/features/admin/components/subscriptions/subscriptions-view";
import { prefetchAdminSubscriptionsFirstPage } from "@/shared/lib/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/subscriptions")({
  loader: ({ context }) =>
    prefetchAdminSubscriptionsFirstPage(context.queryClient),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return <SubscriptionsView />;
}
