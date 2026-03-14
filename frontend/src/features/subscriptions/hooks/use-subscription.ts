/**
 * Subscription Hook
 *
 * React hook for checking user subscription status and access levels.
 * Uses Firebase Auth custom claims set by the Firebase Stripe Extension.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { debugLog } from "@/shared/utils/debug";
import { queryKeys } from "@/shared/lib/query-keys";

export type SubscriptionRole = "basic" | "pro" | "enterprise" | null;

export interface SubscriptionAccess {
  role: SubscriptionRole;
  hasBasicAccess: boolean;
  hasProAccess: boolean;
  hasEnterpriseAccess: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check user's subscription access based on Firebase Auth custom claims
 */
export function useSubscription(): SubscriptionAccess {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<SubscriptionRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const previousRoleRef = useRef<SubscriptionRole>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        debugLog.info("Checking subscription status", {
          service: "subscription-hook",
          operation: "checkSubscription",
        });
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          debugLog.info("No user found, setting role to null", {
            service: "subscription-hook",
            operation: "noUser",
          });
          setRole(null);
          setIsLoading(false);
          return;
        }

        debugLog.info("User found, checking custom claims", {
          service: "subscription-hook",
          operation: "userFound",
        });
        // Force refresh to get latest custom claims
        await user.getIdToken(true);

        const tokenResult = await user.getIdTokenResult();
        const stripeRole = tokenResult.claims.stripeRole as string | undefined;
        const newRole = (stripeRole as SubscriptionRole) || null;

        debugLog.info("Subscription role determined", {
          service: "subscription-hook",
          operation: "roleDetermined",
          stripeRole,
          newRole,
          previousRole: previousRoleRef.current,
        });

        // If role changed, invalidate subscription-related caches
        if (
          previousRoleRef.current !== newRole &&
          previousRoleRef.current !== null
        ) {
          debugLog.info("Role changed, invalidating caches", {
            service: "subscription-hook",
            operation: "invalidateCaches",
            oldRole: previousRoleRef.current,
            newRole,
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.reelsUsage(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.usageStats(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.currentSubscription(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.portalLink(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.admin.subscriptions(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.admin.subscriptionsAnalytics(),
          });
        }

        previousRoleRef.current = newRole;
        setRole(newRole);
        setIsLoading(false);
        debugLog.info("Final role set", {
          service: "subscription-hook",
          operation: "roleSet",
          finalRole: newRole,
        });
      } catch (err) {
        debugLog.error(
          "Error checking subscription",
          {
            service: "subscription-hook",
            operation: "useSubscription",
          },
          err
        );

        setError(err instanceof Error ? err : new Error("Unknown error"));
        setIsLoading(false);
      }
    };

    checkSubscription();

    // Listen for auth state changes
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(() => {
      debugLog.info("Auth state changed, rechecking subscription", {
        service: "subscription-hook",
        operation: "authStateChanged",
      });
      checkSubscription();
    });

    return () => unsubscribe();
  }, [queryClient]);

  return {
    role,
    hasBasicAccess: role === "basic" || role === "pro" || role === "enterprise",
    hasProAccess: role === "pro" || role === "enterprise",
    hasEnterpriseAccess: role === "enterprise",
    isLoading,
    error,
  };
}

/**
 * Hook to check if user has access to a specific tier
 */
export function useHasTierAccess(
  requiredTier: "basic" | "pro" | "enterprise"
): boolean {
  const { role, isLoading } = useSubscription();

  if (isLoading) return false;

  const tierHierarchy: Record<string, number> = {
    basic: 1,
    pro: 2,
    enterprise: 3,
  };

  const userTierLevel = role ? tierHierarchy[role] : 0;
  const requiredTierLevel = tierHierarchy[requiredTier];

  return userTierLevel >= requiredTierLevel;
}
