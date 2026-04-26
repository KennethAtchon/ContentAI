"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/state/auth-context";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/debug";
import {
  fetchOrderDetails,
  type OrderDetails,
} from "../api/order-success.service";

interface UseOrderConfirmationResult {
  error: string | null;
  isLoading: boolean;
  orderDetails: OrderDetails | null;
  retry: () => void;
}

export function useOrderConfirmation(
  orderId: string
): UseOrderConfirmationResult {
  const { user } = useAuth();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const details = await fetchOrderDetails(authenticatedFetch, orderId);
        if (!cancelled) {
          setOrderDetails(details);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        debugLog.error(
          "OrderConfirmation: Failed to fetch order details",
          {
            component: "OrderConfirmation",
            orderId,
          },
          err
        );

        setOrderDetails(null);
        setError(
          err instanceof Error ? err.message : "Failed to load order details"
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, orderId, retryToken, user]);

  return {
    error,
    isLoading,
    orderDetails,
    retry: () => {
      setRetryToken((current) => current + 1);
    },
  };
}
