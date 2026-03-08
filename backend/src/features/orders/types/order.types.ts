/**
 * Order Types
 *
 * TypeScript types for order-related data structures.
 * Maps to the orders table in the Drizzle schema.
 * NOTE: These are one-time purchase orders only. Subscriptions live in Firestore.
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "completed"
  | "canceled"
  | "refunded";

export interface Order {
  id: string;
  userId: string;
  totalAmount: number; // Decimal stored as number in application layer
  status: OrderStatus | string | null;
  stripeSessionId: string | null;
  skipPayment: boolean;
  orderType: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdAt: Date;
}

export interface CreateOrderRequest {
  userId: string;
  totalAmount: number;
  status?: OrderStatus;
  stripeSessionId?: string;
  skipPayment?: boolean;
}

export interface UpdateOrderRequest {
  userId?: string;
  totalAmount?: number;
  status?: OrderStatus;
}

/** Formatted order as returned by the admin/customer routes */
export interface OrderResponse extends Order {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}
