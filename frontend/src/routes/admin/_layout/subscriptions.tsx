import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionsView } from "@/domains/admin/ui/subscriptions/subscriptions-view";
import { prefetchAdminSubscriptionsFirstPage } from "@/app/query/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/subscriptions")({
  loader: ({ context }) =>
    prefetchAdminSubscriptionsFirstPage(context.queryClient),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return <SubscriptionsView />;
}
