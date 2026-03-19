/**
 * Order Checkout Component
 *
 * Handles one-time order checkout UI and logic.
 */

"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ErrorAlert } from "@/shared/components/custom-ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  ShoppingCart,
  Loader2,
  CreditCard,
  Package,
  DollarSign,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/shared/contexts/app-context";
import { useTranslation } from "react-i18next";
import {
  createProductCheckout,
  CheckoutLineItem,
} from "@/features/payments/services/stripe-checkout";
import { ORDER_PRODUCTS } from "@/shared/constants/order.constants";

interface OrderItem {
  name: string;
  description: string;
  price: number; // in dollars
  quantity: number;
  productId?: string;
}

interface OrderCheckoutProps {
  initialItems: OrderItem[];
  onItemsChange?: (items: OrderItem[]) => void;
}

export function OrderCheckout({
  initialItems,
  onItemsChange,
}: OrderCheckoutProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItems = (newItems: OrderItem[]) => {
    setItems(newItems);
    onItemsChange?.(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

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
      // Convert items to Stripe line items format
      const lineItems: CheckoutLineItem[] = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      const _subtotal = calculateSubtotal();
      const baseUrl = window.location.origin;

      // Create checkout session for one-time payment
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
      } else if (result.error) {
        setError(result.error.message || t("checkout_error_failed_session"));
        setIsProcessing(false);
      } else {
        setError(t("checkout_error_failed_session"));
        setIsProcessing(false);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("checkout_error_occurred");
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  const updateItemPrice = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index].price = Math.max(0, price);
    updateItems(newItems);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, quantity);
    updateItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      setError(t("checkout_error_one_item_required"));
      return;
    }
    updateItems(newItems);
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

  const subtotal = calculateSubtotal();

  return (
    <>
      {/* Quick Add Products */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-xl">
            {t("checkout_quick_add_products")}
          </CardTitle>
          <CardDescription>
            {t("common_click_to_add_a_product_to_your_order")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ORDER_PRODUCTS.slice(0, 4).map((product) => (
              <Button
                key={product.id}
                variant="outline"
                className="h-auto flex-col items-start p-3 text-left"
                onClick={() => addProduct(product)}
              >
                <div className="font-semibold text-base mb-1">{product.name}</div>
                <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {product.description}
                </div>
                <div className="text-base font-bold text-primary">
                  ${product.price.toFixed(2)}
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      <ErrorAlert error={error} className="mb-6" />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Order Items */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t("checkout_order_items")}
              </CardTitle>
              <CardDescription>
                {t("common_review_and_adjust_your_order_items")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`item-${index}-name`}>
                        {t("checkout_item_name")}
                      </Label>
                    </div>
                    <Input
                      id={`item-${index}-name`}
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].name = e.target.value;
                        updateItems(newItems);
                      }}
                      placeholder={t("checkout_item_name_placeholder")}
                    />
                    <Input
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].description = e.target.value;
                        updateItems(newItems);
                      }}
                      placeholder={t("checkout_description_placeholder")}
                      className="text-base"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`item-${index}-price`}>
                          {t("checkout_price")}
                        </Label>
                        <Input
                          id={`item-${index}-price`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price.toFixed(2)}
                          onChange={(e) =>
                            updateItemPrice(
                              index,
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div className="w-24">
                        <Label htmlFor={`item-${index}-quantity`}>
                          {t("checkout_quantity")}
                        </Label>
                        <Input
                          id={`item-${index}-quantity`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(
                              index,
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="self-start"
                    >
                      {t("checkout_remove")}
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={addItem} className="w-full">
                <Package className="mr-2 h-4 w-4" />
                {t("checkout_add_item")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="md:col-span-1">
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
                onClick={handleCheckout}
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
        </div>
      </div>

      {/* Info Card */}
      <Card className="mt-6 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                {t("checkout_one_time_purchase")}
              </h3>
              <p className="text-base text-blue-700 dark:text-blue-300">
                {t("checkout_one_time_purchase_description")}{" "}
                <Link
                  to="/pricing"
                  className="underline font-medium hover:text-blue-900"
                >
                  {t("checkout_our_pricing_page")}
                </Link>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
