"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/app/state/auth-context";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/debug";
import { createOrderFromCheckoutSession } from "../api/order-success.service";

interface UseOrderCreationResult {
  error: string | null;
  isCreating: boolean;
  showError: boolean;
  retry: () => void;
}

export function useOrderCreation(sessionId: string): UseOrderCreationResult {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [showError, setShowError] = useState(false);
  const orderCreationAttempted = useRef(false);

  useEffect(() => {
    if (!user?.uid || orderCreationAttempted.current) {
      return;
    }

    orderCreationAttempted.current = true;
    let cancelled = false;
    let errorTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        const orderId = await createOrderFromCheckoutSession(
          authenticatedFetch,
          sessionId,
          user.uid
        );

        if (cancelled) {
          return;
        }

        navigate({
          to: "/payment/success",
          search: { session_id: sessionId, order_id: orderId } as never,
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        debugLog.error(
          "OrderCreator: Order creation failed",
          { component: "OrderCreator" },
          err
        );

        setError(err instanceof Error ? err.message : "Failed to create order");
        setIsCreating(false);

        errorTimer = setTimeout(() => {
          if (!cancelled) {
            setShowError(true);
          }
        }, 2000);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (errorTimer) {
        clearTimeout(errorTimer);
      }
    };
  }, [authenticatedFetch, navigate, sessionId, user]);

  return {
    error,
    isCreating,
    showError,
    retry: () => {
      setError(null);
      setShowError(false);
      setIsCreating(true);
      orderCreationAttempted.current = false;
      window.location.reload();
    },
  };
}
