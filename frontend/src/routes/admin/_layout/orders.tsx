import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/domains/admin/ui/orders/orders-view";
import { prefetchAdminOrdersFirstPage } from "@/app/query/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/orders")({
  loader: ({ context }) => prefetchAdminOrdersFirstPage(context.queryClient),
  component: OrdersPage,
});

function OrdersPage() {
  return <OrdersView />;
}
