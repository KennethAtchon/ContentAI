/**
 * One-time purchase orders (PostgreSQL). Subscriptions live in Firestore.
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
  totalAmount: number;
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

export interface OrderResponse extends Order {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}
