/**
 * Feature Gate Component
 *
 * Wrapper component that conditionally renders content based on subscription tier.
 * Shows fallback content if user doesn't have required access.
 *
 * DESIGN PATTERN: Defensive Programming
 * - Always checks tier hierarchy correctly
 * - Handles loading states gracefully
 * - Provides clear fallback UI
 */

"use client";

import { ReactNode } from "react";
import { useSubscription } from "../hooks/use-subscription";
import { SubscriptionTier } from "@/shared/constants/subscription.constants";
import { hasTierAccess } from "@/shared/utils/permissions/core-feature-permissions";

interface FeatureGateProps {
  requiredTier: SubscriptionTier | null;
  fallback?: ReactNode;
  children: ReactNode;
  showFallbackWhenLoading?: boolean;
}

export function FeatureGate({
  requiredTier,
  fallback = null,
  children,
  showFallbackWhenLoading = true,
}: FeatureGateProps) {
  const {
    role,
    isLoading,
    hasBasicAccess: _hasBasicAccess,
    hasProAccess: _hasProAccess,
    hasEnterpriseAccess: _hasEnterpriseAccess,
  } = useSubscription();

  // If no tier requirement, always render children (free feature)
  if (requiredTier === null) {
    return <>{children}</>;
  }

  if (isLoading && showFallbackWhenLoading) {
    return <>{fallback}</>;
  }

  // Use centralized permission check for consistency
  // This ensures the same logic is used everywhere
  const hasAccess = hasTierAccess(role, requiredTier);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
