"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import {
  ShoppingBag,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { debugLog } from "@/shared/utils/debug";

interface OrderConfirmationProps {
  orderId: string;
}

interface OrderDetails {
  id: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    medicalInfo?: any;
    avatar: string;
    initials: string;
  };
  therapies: Array<{
    id: string;
    name: string;
    description?: string;
    price: string;
    duration?: number;
    quantity: number;
  }>;
  status: string;
  totalAmount: string;
  createdAt: string;
  stripeSessionId?: string;
}

export function OrderConfirmation({ orderId }: OrderConfirmationProps) {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useApp();
  const { authenticatedFetch } = useAuthenticatedFetch();

  // Page is under (customer)/(main) layout with AuthGuard; user is guaranteed.
  // Fetch order details when user is available.
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!user) return; // Don't fetch if no authenticated user

      try {
        debugLog.info("OrderConfirmation: Fetching order details", {
          component: "OrderConfirmation",
          orderId,
        });

        const response = await authenticatedFetch(
          `/api/customer/orders/${orderId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Order not found");
          }
          throw new Error(`Failed to fetch order details (${response.status})`);
        }

        const data = await response.json();

        if (!data.order) {
          throw new Error("Invalid order data received");
        }

        debugLog.info("OrderConfirmation: Order details fetched successfully", {
          component: "OrderConfirmation",
          orderId: data.order.id,
        });

        setOrderDetails(data.order);
      } catch (err) {
        debugLog.error(
          "OrderConfirmation: Failed to fetch order details",
          {
            component: "OrderConfirmation",
            orderId,
          },
          err
        );

        setError(
          err instanceof Error ? err.message : "Failed to load order details"
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrderDetails();
    }
  }, [orderId, user]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Reload the page to retry
    window.location.reload();
  };

  if (loading) {
    return (
      <Card className="mb-8">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
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
            <h3 className="text-lg font-semibold text-error mb-2">
              Failed to Load Order
            </h3>
            <p className="text-error mb-4">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={handleRetry}
                className="bg-error hover:bg-error text-white px-4 py-2 rounded-md"
              >
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link to="/account">Go to Account</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orderDetails) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Success Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>
        <p className="text-xl text-gray-600">
          Your order has been processed successfully.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Order Summary
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  orderDetails.status === "completed" ? "default" : "secondary"
                }
              >
                {orderDetails.status}
              </Badge>
              <span className="text-sm text-gray-500">
                #{orderDetails.id.slice(-8)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orderDetails.therapies.map((therapy) => (
                <div
                  key={therapy.id}
                  className="flex justify-between items-start"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{therapy.name}</h4>
                    <p className="text-sm text-gray-500">
                      Quantity: {therapy.quantity}
                    </p>
                    {therapy.duration && (
                      <p className="text-sm text-gray-500">
                        {therapy.duration} minutes
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      $
                      {(parseFloat(therapy.price) * therapy.quantity).toFixed(
                        2
                      )}
                    </p>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total:</span>
                <span className="text-teal-600">
                  ${parseFloat(orderDetails.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderDetails.customer.name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{orderDetails.customer.name}</span>
                </div>
              )}
              {orderDetails.customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{orderDetails.customer.email}</span>
                </div>
              )}
              {orderDetails.customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{orderDetails.customer.phone}</span>
                </div>
              )}
              {orderDetails.customer.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                  <span className="text-sm">
                    {orderDetails.customer.address}
                  </span>
                </div>
              )}
              {orderDetails.customer.medicalInfo && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                  <span className="text-sm">Medical Information Available</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button asChild size="lg" className="bg-teal-600 hover:bg-teal-700">
          <Link to="/account">
            <User className="mr-2 h-5 w-5" />
            View My Account
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/studio/discover">
            <ShoppingBag className="mr-2 h-5 w-5" />
            Go to Studio
          </Link>
        </Button>
      </div>
    </div>
  );
}
