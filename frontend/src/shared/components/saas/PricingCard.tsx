/**
 * Pricing Card Component - Modern SaaS Design
 *
 * Reusable pricing card component for displaying subscription tiers with modern SaaS styling.
 */

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import {
  SubscriptionTierConfig,
  SUBSCRIPTION_TRIAL_DAYS,
} from "@/shared/constants/subscription.constants";
import { cn } from "@/shared/utils/helpers/utils";
import { debugLog } from "@/shared/utils/debug";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { usePortalLink } from "@/shared/hooks/use-portal-link";
import { useApp } from "@/shared/contexts/app-context";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useTranslation } from "react-i18next";
import { useSmartRedirect } from "@/shared/utils/redirect/redirect-util";

interface PricingCardProps {
  tier: SubscriptionTierConfig;
  tierKey: string;
  isPopular?: boolean;
}

export function PricingCard({
  tier,
  tierKey,
  isPopular = false,
}: PricingCardProps) {
  const { t } = useTranslation();
  const { role } = useSubscription();
  const { portalUrl, isLoading: portalLoading } = usePortalLink();
  const { user } = useApp();
  const { redirectToCheckout, redirectToAuth } = useSmartRedirect();
  const subscriptionFetcher = useQueryFetcher<{
    subscription: {
      id: string;
      tier: string;
      billingCycle: "monthly" | "annual" | null;
      status: string;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      isInTrial: boolean;
      trialEnd: string | null;
    } | null;
    tier: string | null;
    billingCycle: "monthly" | "annual" | null;
    isInTrial: boolean;
  }>();
  const trialFetcher = useQueryFetcher<{
    isEligible: boolean;
    hasUsedFreeTrial: boolean;
    isInTrial: boolean;
  }>();

  // Get accurate subscription data from API
  const { data: currentSubscription } = useQuery({
    queryKey: queryKeys.api.currentSubscription(),
    queryFn: () => subscriptionFetcher("/api/subscriptions/current"),
    enabled: !!user,
  });

  // Use API data to determine if user has active subscription
  const hasActiveSubscription =
    currentSubscription?.subscription &&
    (currentSubscription.subscription.status === "active" ||
      currentSubscription.subscription.status === "trialing");

  const { data: trialEligibilityData } = useQuery({
    queryKey: queryKeys.api.trialEligibility(),
    queryFn: () => trialFetcher("/api/subscriptions/trial-eligibility"),
    enabled: !!user && !role,
  });

  const trialEligible = trialEligibilityData?.isEligible ?? false;

  const handleButtonClick = () => {
    debugLog.info("Pricing card button clicked", {
      service: "pricing-card",
      operation: "handleButtonClick",
      hasActiveSubscription,
      hasRole: !!role,
      role,
      isAuthenticated: !!user,
      portalUrlAvailable: !!portalUrl,
      currentTier: currentSubscription?.tier,
      requestedTier: tierKey,
      billingCycle: tier.billingCycle,
    });

    if (role && portalUrl) {
      // Check if this is an upgrade
      const currentTier = role;
      const tierHierarchy: Record<string, number> = {
        basic: 1,
        pro: 2,
        enterprise: 3,
      };
      const currentLevel = tierHierarchy[currentTier || "basic"] || 0;
      const requestedLevel = tierHierarchy[tierKey || "basic"] || 0;

      debugLog.info("Checking if upgrade or same/lower tier", {
        service: "pricing-card",
        operation: "tierComparison",
        currentLevel,
        requestedLevel,
        isUpgrade: requestedLevel > currentLevel,
      });

      if (requestedLevel <= currentLevel) {
        debugLog.info(
          "User purchasing same/lower tier, redirecting to portal",
          {
            service: "pricing-card",
            operation: "redirectToPortal",
          }
        );
        // User has subscription and wants same/lower tier - redirect to portal
        window.location.href = portalUrl;
      } else {
        debugLog.info("User upgrading subscription, redirecting to checkout", {
          service: "pricing-card",
          operation: "redirectToCheckout",
        });
        // User has subscription but wants to upgrade - go to checkout
        if (user) {
          redirectToCheckout({
            tier: tierKey,
            billingCycle: tier.billingCycle,
          });
        } else {
          const checkoutUrl = `${window.location.origin}/checkout?tier=${tierKey}&billing=${tier.billingCycle}`;
          redirectToAuth({
            isSignUp: true,
            returnUrl: checkoutUrl,
          });
        }
      }
    } else if (!role) {
      debugLog.info("User without subscription, proceeding to checkout", {
        service: "pricing-card",
        operation: "newUserCheckout",
        isAuthenticated: !!user,
      });
      // User doesn't have subscription - check if authenticated
      if (user) {
        // Authenticated user - go to checkout
        redirectToCheckout({
          tier: tierKey,
          billingCycle: tier.billingCycle,
        });
      } else {
        // Unauthenticated user - go to sign-up first
        const checkoutUrl = `${window.location.origin}/checkout?tier=${tierKey}&billing=${tier.billingCycle}`;
        redirectToAuth({
          isSignUp: true,
          returnUrl: checkoutUrl,
        });
      }
    } else {
      debugLog.warn("Unexpected state - has subscription but no portal URL", {
        service: "pricing-card",
        operation: "unexpectedState",
        hasActiveSubscription,
        portalUrlAvailable: !!portalUrl,
      });
    }
  };

  const showTrial =
    trialEligible === true && SUBSCRIPTION_TRIAL_DAYS > 0 && !role;

  const buttonText = role
    ? t("account_subscription_manage_subscription")
    : showTrial
      ? t("home_hero_cta_start_trial")
      : t("common_get_started");
  const isButtonDisabled = Boolean(role && (!portalUrl || portalLoading));

  return (
    <Card
      className={cn(
        "relative flex flex-col transition-all duration-300",
        isPopular
          ? "border-2 border-primary shadow-xl scale-105 bg-gradient-to-br from-primary/5 to-purple-500/5"
          : "border-2 hover:border-primary/50 hover:shadow-lg"
      )}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white px-4 py-1.5 text-sm font-semibold shadow-lg">
            <Sparkles className="h-3 w-3 mr-1.5" />
            {t("common_most_popular")}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-6">
        <CardTitle className="text-2xl font-bold mb-2">{tier.name}</CardTitle>
        <CardDescription className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-foreground">
              ${tier.price.toFixed(2)}
            </span>
            <span className="text-muted-foreground text-lg">
              {tier.billingCycle === "monthly"
                ? t("checkout_per_month")
                : t("checkout_per_year")}
            </span>
          </div>
          {tier.billingCycle === "annual" && (
            <p className="text-sm text-muted-foreground">
              (${(tier.price / 12).toFixed(2)}/month)
            </p>
          )}
          {showTrial ? (
            <div className="flex items-center gap-2 pt-2">
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 border-2 border-green-500/30 px-4 py-1.5 text-sm font-semibold shadow-sm"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {t("checkout_day_trial", { days: SUBSCRIPTION_TRIAL_DAYS })}
              </Badge>
              <p className="text-xs text-green-700 font-medium">
                {t("common_no_credit_card_required")}
              </p>
            </div>
          ) : !hasActiveSubscription ? (
            <p className="text-sm text-muted-foreground pt-1">
              {t("common_no_credit_card_required")}
            </p>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pb-6">
        <ul className="space-y-3.5">
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm leading-relaxed">
              {tier.features.maxReelsPerMonth === -1 ? (
                <><span className="font-semibold">{t("calculator_unlimited")}</span> reels/month</>
              ) : (
                <><span className="font-semibold">{tier.features.maxReelsPerMonth.toLocaleString()}</span> reels/month</>
              )}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm leading-relaxed">
              {tier.features.maxGenerationsPerMonth === -1 ? (
                <><span className="font-semibold">{t("calculator_unlimited")}</span> AI generations/month</>
              ) : (
                <><span className="font-semibold">{tier.features.maxGenerationsPerMonth.toLocaleString()}</span> AI generations/month</>
              )}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm leading-relaxed">
              {tier.features.instagramPublishing ? "Instagram publishing" : "Content queue (no publishing)"}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm leading-relaxed">
              {t("account_subscription_support_level", {
                level:
                  tier.features.supportLevel.charAt(0).toUpperCase() +
                  tier.features.supportLevel.slice(1),
              })}
            </span>
          </li>
          {tier.features.apiAccess && (
            <li className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm leading-relaxed">
                {t("checkout_api_access_included")}
              </span>
            </li>
          )}
          {tier.features.customBranding && (
            <li className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm leading-relaxed">
                {t("checkout_custom_branding_available")}
              </span>
            </li>
          )}
        </ul>
      </CardContent>

      <CardFooter className="pt-6">
        <Button
          className={cn(
            "w-full h-12 text-base font-semibold transition-all hover:scale-105",
            isPopular &&
              !hasActiveSubscription &&
              "bg-gradient-to-r from-primary to-purple-600 hover:shadow-lg"
          )}
          variant="default"
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
        >
          <span className="flex items-center justify-center gap-2">
            {portalLoading && hasActiveSubscription
              ? t("common_loading_subscriptions")
              : buttonText}
            {!portalLoading && <ArrowRight className="h-4 w-4" />}
          </span>
        </Button>
      </CardFooter>
    </Card>
  );
}
