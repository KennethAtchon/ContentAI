import { OrdersList } from "@/domains/admin/ui/orders/orders-list";

// Constants
const DEFAULT_RECENT_ORDERS_LIMIT = 5;

interface RecentOrdersListProps {
  limit?: number;
}

/**
 * Recent orders list component that displays a limited number of recent orders
 */
export function RecentOrdersList({
  limit = DEFAULT_RECENT_ORDERS_LIMIT,
}: RecentOrdersListProps) {
  return <OrdersList limit={limit} />;
}
