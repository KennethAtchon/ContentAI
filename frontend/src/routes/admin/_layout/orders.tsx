import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/features/admin/components/orders/orders-view";

export const Route = createFileRoute("/admin/_layout/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  return <OrdersView />;
}
