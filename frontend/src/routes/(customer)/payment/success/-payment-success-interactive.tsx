import { useSearch } from "@tanstack/react-router";
import { OrderCreator } from "@/domains/payments/ui/success/order-creator";
import { SubscriptionSuccess } from "@/domains/payments/ui/success/subscription-success";
import { OrderSuccess } from "@/domains/payments/ui/success/order-success";

export function PaymentSuccessInteractive() {
  const search = useSearch({ from: "/(customer)/payment/success/" }) as Record<
    string,
    string | undefined
  >;

  const sessionId = search.session_id ?? null;
  const type = search.type;
  const orderId = search.order_id ?? null;
  const paymentType = type === "subscription" ? "subscription" : "order";

  const needsOrderCreation =
    paymentType === "order" && sessionId !== null && orderId === null;

  return (
    <div className="mx-auto max-w-2xl">
      {needsOrderCreation && <OrderCreator sessionId={sessionId} />}

      {!needsOrderCreation && (
        <>
          {paymentType === "subscription" ? (
            <SubscriptionSuccess sessionId={sessionId} />
          ) : (
            <OrderSuccess sessionId={sessionId} orderId={orderId} />
          )}
        </>
      )}
    </div>
  );
}
