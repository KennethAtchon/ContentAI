/**
 * Order Checkout Component
 *
 * Handles one-time order checkout UI and logic.
 */

"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "@/shared/components/feedback/error-alert";
import { useApp } from "@/shared/contexts/app-context";
import { ORDER_PRODUCTS } from "@/shared/constants/order.constants";
import { createProductCheckout, CheckoutLineItem } from "@/features/payments/services/stripe-checkout";
import type { OrderItem } from "./order-checkout.types";
import { QuickAddProducts } from "./order/QuickAddProducts";
import { OrderItemsCard } from "./order/OrderItemsCard";
import { OrderSummaryCard } from "./order/OrderSummaryCard";
import { OneTimePurchaseInfoCard } from "./order/OneTimePurchaseInfoCard";

interface OrderCheckoutProps {
  initialItems: OrderItem[];
  onItemsChange?: (items: OrderItem[]) => void;
}

export function OrderCheckout({ initialItems, onItemsChange }: OrderCheckoutProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItems = (next: OrderItem[]) => {
    setItems(next);
    onItemsChange?.(next);
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      setError(t("checkout_error_sign_in"));
      return;
    }
    if (items.length === 0) {
      setError(t("checkout_error_add_items"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const lineItems: CheckoutLineItem[] = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      const baseUrl = window.location.origin;
      const result = await createProductCheckout(user.uid, lineItems, {
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payment/cancel`,
        allow_promotion_codes: true,
        metadata: {
          userId: user.uid,
          userEmail: user.email || "",
          orderType: "one_time",
        },
      });

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      setError(result.error?.message || t("checkout_error_failed_session"));
      setIsProcessing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkout_error_occurred"));
      setIsProcessing(false);
    }
  };

  const updateItemPrice = (index: number, price: number) => {
    const next = [...items];
    next[index].price = Math.max(0, price);
    updateItems(next);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const next = [...items];
    next[index].quantity = Math.max(1, quantity);
    updateItems(next);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    if (next.length === 0) {
      setError(t("checkout_error_one_item_required"));
      return;
    }
    updateItems(next);
  };

  const addItem = () => {
    updateItems([
      ...items,
      {
        name: t("checkout_item_name"),
        description: t("checkout_description_placeholder"),
        price: 0,
        quantity: 1,
      },
    ]);
  };

  const addProduct = (product: (typeof ORDER_PRODUCTS)[0]) => {
    updateItems([
      ...items,
      {
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: 1,
        productId: product.id,
      },
    ]);
  };

  return (
    <>
      <QuickAddProducts onAddProduct={addProduct} t={t} />
      <ErrorAlert error={error} className="mb-6" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <OrderItemsCard
            items={items}
            onItemsChange={updateItems}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onUpdateItemPrice={updateItemPrice}
            onUpdateItemQuantity={updateItemQuantity}
            t={t}
          />
        </div>

        <div className="md:col-span-1">
          <OrderSummaryCard
            items={items}
            subtotal={subtotal}
            isProcessing={isProcessing}
            onCheckout={handleCheckout}
            t={t}
          />
        </div>
      </div>

      <OneTimePurchaseInfoCard t={t} />
    </>
  );
}

