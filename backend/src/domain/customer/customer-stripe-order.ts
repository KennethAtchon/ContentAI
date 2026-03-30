import type Stripe from "stripe";
import { Errors } from "../../utils/errors/app-error";
import type { CustomerService } from "./customer.service";

type OrderRow = Awaited<ReturnType<CustomerService["createOrderFromCheckout"]>>;

/**
 * Verifies a Stripe Checkout Session (mode=payment) and creates or returns the user's order.
 */
export async function createOrderFromStripeCheckoutSession(
  stripe: Stripe,
  customerService: CustomerService,
  params: {
    userId: string;
    firebaseUid: string;
    stripeSessionId: string;
    status?: string;
  },
): Promise<{ order: OrderRow; status: 200 | 201 }> {
  const { userId, firebaseUid, stripeSessionId, status } = params;

  const existing = await customerService.getOrderByStripeSessionId(
    userId,
    stripeSessionId,
  );
  if (existing) {
    return { order: existing, status: 200 };
  }

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

  if (session.mode !== "payment") {
    throw Errors.badRequest(
      "Checkout session is not a one-time payment",
      "INVALID_SESSION_MODE",
    );
  }

  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    throw Errors.badRequest(
      `Payment not completed for this session: ${session.payment_status}`,
      "PAYMENT_NOT_COMPLETED",
    );
  }

  const metaUserId = session.metadata?.userId;
  if (!metaUserId || metaUserId !== firebaseUid) {
    throw Errors.forbidden("Session does not belong to this user");
  }

  const amountCents = session.amount_total;
  if (amountCents == null) {
    throw Errors.badRequest(
      "Session has no amount_total; cannot create order",
      "MISSING_AMOUNT",
    );
  }

  const totalAmount = (amountCents / 100).toFixed(2);

  try {
    const order = await customerService.createOrderFromCheckout(userId, {
      totalAmount,
      status: status ?? "completed",
      stripeSessionId,
    });
    return { order, status: 201 };
  } catch (insertErr: unknown) {
    const code =
      insertErr && typeof insertErr === "object" && "code" in insertErr
        ? (insertErr as { code?: string }).code
        : undefined;
    if (code === "23505") {
      const race = await customerService.getOrderByStripeSessionId(
        userId,
        stripeSessionId,
      );
      if (race) return { order: race, status: 200 };
    }
    throw insertErr;
  }
}
