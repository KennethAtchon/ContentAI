import type {
  OrderSuccessData,
  PaymentSuccessParams,
  PaymentSuccessType,
  SubscriptionSuccessData,
} from "@contracts/payments";

export type PaymentMethod =
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "cash"
  | "digital_wallet";

/**
 * Payment Transaction Status
 *
 * Detailed status for payment transactions (payment-level tracking).
 * For order payment status, see PaymentStatus in order.types.ts
 */
export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded";

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  processorResponse?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  clientSecret: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerInfo {
  email: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface ProcessPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerInfo?: CustomerInfo;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  clientSecret?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
}

export interface PaymentFilter {
  customerId?: string;
  orderId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
}

export type {
  OrderSuccessData,
  PaymentSuccessParams,
  PaymentSuccessType,
  SubscriptionSuccessData,
};
