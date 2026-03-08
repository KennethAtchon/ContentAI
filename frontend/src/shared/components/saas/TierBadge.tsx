/**
 * Tier Badge Component
 *
 * Displays subscription tier with appropriate styling.
 */

"use client";

import { Badge } from "@/shared/components/ui/badge";
import { SubscriptionTier } from "@/shared/constants/subscription.constants";
import { cn } from "@/shared/utils/helpers/utils";

interface TierBadgeProps {
  tier: SubscriptionTier;
  className?: string;
}

const tierColors: Record<SubscriptionTier, string> = {
  basic: "bg-blue-100 text-blue-800 border-blue-200",
  pro: "bg-purple-100 text-purple-800 border-purple-200",
  enterprise: "bg-amber-100 text-amber-800 border-amber-200",
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-semibold", tierColors[tier], className)}
    >
      {tier}
    </Badge>
  );
}
