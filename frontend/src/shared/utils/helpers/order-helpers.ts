/**
 * Order Formatting Helpers
 *
 * Shared utilities for building the standard order response shape returned by
 * all order-related API routes. Previously the initials derivation and formatted
 * order object were copy-pasted inline across four route files.
 */

const DEFAULT_AVATAR = "/placeholder-user.jpg";

interface OrderUser {
  name: string;
  email: string;
}

export interface FormattedOrderResponse {
  id: string;
  customer: {
    name: string;
    email: string;
    avatar: string;
    initials: string;
  };
  status: string;
  totalAmount: string;
  createdAt: Date;
}

/**
 * Derives two-letter initials from a full name (first letter of each word,
 * upper-cased). Returns an empty string if name is falsy.
 */
export function deriveInitials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * Builds the standard formatted order response shape used by both admin and
 * customer-facing order endpoints.
 */
export function formatOrderResponse(order: {
  id: string;
  user: OrderUser;
  status: string | null;
  totalAmount: { toString(): string } | number | string;
  createdAt: Date;
}): FormattedOrderResponse {
  const { user } = order;
  return {
    id: order.id,
    customer: {
      name: user.name,
      email: user.email,
      avatar: DEFAULT_AVATAR,
      initials: deriveInitials(user.name),
    },
    status: order.status || "PENDING",
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt,
  };
}
