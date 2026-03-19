/**
 * Upgrade Prompt Component
 *
 * Component to prompt users to upgrade their subscription tier.
 */

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowUp, Sparkles } from "lucide-react";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { ManageSubscriptionButton } from "@/features/subscriptions/components/manage-subscription-button";

interface UpgradePromptProps {
  currentTier?: string;
  requiredTier: string;
  featureName?: string;
  className?: string;
}

export function UpgradePrompt({
  currentTier,
  requiredTier,
  featureName,
  className,
}: UpgradePromptProps) {
  const { role } = useSubscription();
  const hasSubscription = !!role;
  const tierNames: Record<string, string> = {
    basic: "Basic",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Upgrade Required</CardTitle>
        </div>
        <CardDescription>
          {featureName
            ? `This feature requires a ${tierNames[requiredTier] || requiredTier} plan.`
            : `This feature is available in ${tierNames[requiredTier] || requiredTier} and higher plans.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentTier && (
          <p className="text-base text-muted-foreground">
            Your current plan:{" "}
            <span className="font-medium capitalize">{currentTier}</span>
          </p>
        )}
        {hasSubscription ? (
          <ManageSubscriptionButton className="w-full">
            Manage Subscription
          </ManageSubscriptionButton>
        ) : (
          <Button asChild className="w-full">
            <Link to="/pricing">
              <ArrowUp className="mr-2 h-4 w-4" />
              Upgrade to {tierNames[requiredTier] || requiredTier}
            </Link>
          </Button>
        )}
        <p className="text-sm text-center text-muted-foreground">
          All plans include a 14-day free trial
        </p>
      </CardContent>
    </Card>
  );
}
