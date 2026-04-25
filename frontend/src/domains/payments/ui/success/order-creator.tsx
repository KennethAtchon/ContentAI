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

import { Card, CardContent } from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import { useOrderCreation } from "../../hooks/use-order-creation";

interface OrderCreatorProps {
  sessionId: string;
}

export function OrderCreator({ sessionId }: OrderCreatorProps) {
  const { error, showError, retry } = useOrderCreation(sessionId);

  // Only show error state after delay to prevent premature error screens
  if (showError && error) {
    return (
      <Card className="mb-8 border-error">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-error mb-4">
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
            <h3 className="text-xl font-semibold text-error mb-2">
              Order Creation Failed
            </h3>
            <p className="text-error mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={retry}
              className="bg-error hover:bg-error text-white px-4 py-2 rounded-md"
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
          <p className="text-base text-gray-500 mt-2">
            Please wait while we process your payment
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
