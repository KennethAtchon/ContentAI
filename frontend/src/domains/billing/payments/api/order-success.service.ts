import { debugLog } from "@/shared/debug";

type AuthenticatedFetch = (
  url: string,
  options?: RequestInit,
  timeout?: number,
) => Promise<Response>;

export interface OrderDetails {
  id: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    medicalInfo?: unknown;
    avatar: string;
    initials: string;
  };
  therapies: Array<{
    id: string;
    name: string;
    description?: string;
    price: string;
    duration?: number;
    quantity: number;
  }>;
  status: string;
  totalAmount: string;
  createdAt: string;
  stripeSessionId?: string;
}

interface CreateOrderResponse {
  order?: { id?: string };
  id?: string;
  data?: { id?: string };
}

function resolveOrderId(result: CreateOrderResponse): string | null {
  return result.order?.id ?? result.id ?? result.data?.id ?? null;
}

export async function createOrderFromCheckoutSession(
  authenticatedFetch: AuthenticatedFetch,
  sessionId: string,
  userId: string,
): Promise<string> {
  debugLog.info("OrderCreator: Starting order creation", {
    component: "OrderCreator",
    sessionId,
    userId,
  });

  const response = await authenticatedFetch("/api/customer/orders/create", {
    method: "POST",
    body: JSON.stringify({
      status: "completed",
      stripeSessionId: sessionId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Order creation failed with status ${response.status}`);
  }

  const result = (await response.json()) as CreateOrderResponse;
  const orderId = resolveOrderId(result);
  if (!orderId) {
    throw new Error("No order ID returned from API");
  }

  debugLog.info("OrderCreator: Order created successfully", {
    component: "OrderCreator",
    orderId,
  });

  return orderId;
}

export async function fetchOrderDetails(
  authenticatedFetch: AuthenticatedFetch,
  orderId: string,
): Promise<OrderDetails> {
  debugLog.info("OrderConfirmation: Fetching order details", {
    component: "OrderConfirmation",
    orderId,
  });

  const response = await authenticatedFetch(`/api/customer/orders/${orderId}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Order not found");
    }

    throw new Error(`Failed to fetch order details (${response.status})`);
  }

  const data = (await response.json()) as { order?: OrderDetails };
  if (!data.order) {
    throw new Error("Invalid order data received");
  }

  debugLog.info("OrderConfirmation: Order details fetched successfully", {
    component: "OrderConfirmation",
    orderId: data.order.id,
  });

  return data.order;
}
