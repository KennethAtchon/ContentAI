/**
 * UpgradePrompt Component
 *
 * Standardized upgrade prompt card for FeatureGate fallbacks.
 */

import { Link } from "@tanstack/react-router";
import { ArrowRight, LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import {
  SubscriptionTier,
  getTierDescription,
} from "@/shared/constants/subscription.constants";
import { useTranslation } from "react-i18next";
import { useSubscription } from "@/domains/subscriptions/hooks/use-subscription";
import { ManageSubscriptionButton } from "@/domains/subscriptions/ui/manage-subscription-button";

export interface UpgradePromptProps {
  /**
   * Required tier for the feature (null for free features - returns null)
   */
  requiredTier: SubscriptionTier | null;
  /**
   * Feature name
   */
  featureName: string;
  /**
   * Feature description
   */
  featureDescription?: string;
  /**
   * Icon for the feature
   */
  icon?: LucideIcon;
  /**
   * Custom className
   */
  className?: string;
}

export function UpgradePrompt({
  requiredTier,
  featureName,
  featureDescription,
  icon: Icon,
  className,
}: UpgradePromptProps) {
  const { t } = useTranslation();
  const { role } = useSubscription();
  const hasSubscription = !!role;

  // If no tier requirement, return null (free feature doesn't need upgrade prompt)
  if (requiredTier === null) {
    return null;
  }
  const tierName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);
  const tierDescription = getTierDescription(requiredTier);

  return (
    <Card
      className={`border-2 bg-gradient-to-br from-primary/5 to-purple-500/5 ${className || ""}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {t("subscription_upgrade_feature", { tier: tierName })}
        </CardTitle>
        <CardDescription>
          {t("subscription_available_in", { featureName, tierDescription })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {featureDescription && (
          <p className="text-base text-muted-foreground">
            {featureDescription}
          </p>
        )}
        {hasSubscription ? (
          <ManageSubscriptionButton className="w-full sm:w-auto">
            {t("account_subscription_manage_subscription")}
          </ManageSubscriptionButton>
        ) : (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/pricing">
              {t("subscription_upgrade_to", { tier: tierName })}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
