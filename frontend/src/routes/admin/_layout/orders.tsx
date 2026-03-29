import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/features/admin/components/orders/orders-view";
import { prefetchAdminOrdersFirstPage } from "@/shared/lib/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/orders")({
  loader: ({ context }) =>
    prefetchAdminOrdersFirstPage(context.queryClient),
  component: OrdersPage,
});

function OrdersPage() {
  return <OrdersView />;
}
