import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { CreditCard, DollarSign, Loader2 } from "lucide-react";
import type { OrderItem } from "../order-checkout.types";

interface OrderSummaryCardProps {
  items: OrderItem[];
  subtotal: number;
  isProcessing: boolean;
  onCheckout: () => void;
  t: (key: string) => string;
}

export function OrderSummaryCard({
  items,
  subtotal,
  isProcessing,
  onCheckout,
  t,
}: OrderSummaryCardProps) {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t("order_detail_order_summary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between text-base">
              <span className="text-muted-foreground">
                {item.name} × {item.quantity}
              </span>
              <span className="font-medium">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xl font-semibold">
              {t("admin_contact_messages_total")}
            </span>
            <span className="text-3xl font-bold">
              <DollarSign className="inline h-5 w-5" />
              {subtotal.toFixed(2)}
            </span>
          </div>
        </div>
        <Button
          onClick={onCheckout}
          disabled={isProcessing || subtotal <= 0}
          className="w-full h-12 text-lg font-semibold"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("checkout_processing")}
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {t("checkout_proceed_to_payment")}
            </>
          )}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          {t("checkout_redirected_to_stripe")}
        </p>
      </CardContent>
    </Card>
  );
}
