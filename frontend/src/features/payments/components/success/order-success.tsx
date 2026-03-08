/**
 * Order Success Component
 *
 * Displays success message and next steps for one-time order purchases.
 * Used when payment type is 'order' or when OrderCreator is present.
 */

"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { CheckCircle2, ShoppingCart, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface OrderSuccessProps {
  sessionId: string | null;
  orderId: string | null;
}

export function OrderSuccess({ sessionId, orderId }: OrderSuccessProps) {
  return (
    <>
      {/* Success Animation */}
      <Card className="border-2 bg-gradient-to-br from-green-500/5 to-primary/5">
        <CardContent className="p-12 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Payment Successful!
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Your order has been processed successfully. Thank you for your
            purchase!
          </p>

          {/* Success Details */}
          <div className="mb-8 space-y-3 rounded-lg border bg-background/50 p-6">
            <div className="flex items-center justify-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="font-medium">Order Confirmed</span>
            </div>
            {sessionId && (
              <p className="text-xs text-muted-foreground">
                Session ID: {sessionId.substring(0, 20)}...
              </p>
            )}
            {orderId && (
              <p className="text-xs text-muted-foreground">
                Order ID: {orderId.substring(0, 20)}...
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Button asChild size="lg" className="h-12 shadow-lg">
              <Link to="/account">
                <ShoppingCart className="mr-2 h-5 w-5" />
                View Orders
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-2"
            >
              <Link to="/">
                <ArrowRight className="mr-2 h-5 w-5" />
                Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
