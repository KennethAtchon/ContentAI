export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled";

/**
 * Order Payment Status
 *
 * Simplified payment status for orders (order-level payment tracking).
 * For detailed payment transaction status, see PaymentStatus in payment.types.ts
 */
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  customerId: string;
  items: Omit<OrderItem, "id">[];
  notes?: string;
}

export interface CreateOrderItemRequest {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface OrderFilter {
  customerId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface OrderUpdateRequest {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  notes?: string;
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
}
