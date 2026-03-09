/**
 * OrderCreator Component - Creates Orders for ONE-TIME PURCHASES only
 *
 * ARCHITECTURE NOTE:
 * ==================
 * This component creates Orders in Prisma for ONE-TIME purchases only.
 *
 * DO NOT use this component for subscriptions:
 *   - Subscriptions are handled by Firebase Stripe Extension → stored in Firestore
 *   - Subscription success page: /payment/success (without OrderCreator)
 *   - Subscriptions are automatically created in Firestore by Firebase Extension
 *
 * Use this component for:
 *   - One-time product purchases
 *   - One-time service payments
 *   - Any non-recurring payment that needs an Order record
 *
 * Separation of concerns:
 *   - Subscriptions → Firestore (via Firebase Extension, no OrderCreator needed)
 *   - One-time Orders → Prisma (this component)
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/shared/contexts/app-context";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { Card, CardContent } from "@/shared/components/ui/card";
import { debugLog } from "@/shared/utils/debug";
import { Button } from "@/shared/components/ui/button";

interface OrderCreatorProps {
  sessionId: string;
}

export function OrderCreator({ sessionId }: OrderCreatorProps) {
  const { user } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [_isCreating, setIsCreating] = useState(true);
  const [showError, setShowError] = useState(false);
  const orderCreationAttempted = useRef(false);
  const { authenticatedFetch } = useAuthenticatedFetch();

  // Page is under (customer)/(main) layout with AuthGuard; user is guaranteed.
  useEffect(() => {
    if (!user) return;

    // Prevent multiple order creation attempts
    if (orderCreationAttempted.current) return;
    orderCreationAttempted.current = true;

    const createOrder = async () => {
      try {
        debugLog.info("OrderCreator: Starting order creation", {
          component: "OrderCreator",
          sessionId,
          userId: user?.uid,
        });

        // Only set errors after we're properly initialized
        // These checks should not fail at this point since we wait for initialization
        if (!user?.uid) {
          throw new Error("User not authenticated");
        }

        // Create order - SaaS model, no products
        const orderRes = await authenticatedFetch(
          "/api/customer/orders/create",
          {
            method: "POST",
            body: JSON.stringify({
              status: "completed",
              stripeSessionId: sessionId,
            }),
          }
        );

        if (!orderRes.ok) {
          throw new Error(
            `Order creation failed with status ${orderRes.status}`
          );
        }

        const orderResult = await orderRes.json();
        const orderId =
          orderResult.order?.id || orderResult.id || orderResult.data?.id;

        if (!orderId) {
          throw new Error("No order ID returned from API");
        }

        debugLog.info("OrderCreator: Order created successfully", {
          component: "OrderCreator",
          orderId,
        });

        // Redirect to the same page but with order_id parameter
        navigate({
          to: `/payment/success`,
          search: { session_id: sessionId, order_id: orderId } as any,
        });
      } catch (err) {
        debugLog.error(
          "OrderCreator: Order creation failed",
          {
            component: "OrderCreator",
          },
          err
        );

        setError(err instanceof Error ? err.message : "Failed to create order");
        setIsCreating(false);

        // Wait 2 seconds before showing the error to prevent premature error screens
        setTimeout(() => {
          setShowError(true);
        }, 2000);
      }
    };

    createOrder();
  }, [sessionId, user, navigate, authenticatedFetch]);

  const handleRetry = () => {
    setError(null);
    setShowError(false);
    setIsCreating(true);
    orderCreationAttempted.current = false; // Reset the flag for retry
    // This will trigger the useEffect again
    window.location.reload();
  };

  // Only show error state after delay to prevent premature error screens
  if (showError && error) {
    return (
      <Card className="mb-8 border-red-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Order Creation Failed
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={handleRetry}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // AuthGuard at layout ensures user; show creating state until order is created or error.
  return (
    <Card className="mb-8">
      <CardContent className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Creating your order...</p>
          <p className="text-sm text-gray-500 mt-2">
            Please wait while we process your payment
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
