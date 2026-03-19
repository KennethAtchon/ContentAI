/**
 * Subscription Checkout Component
 *
 * Handles subscription checkout UI and logic.
 */

"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ErrorAlert } from "@/shared/components/custom-ui/error-alert";
import { Badge } from "@/shared/components/ui/badge";
import {
  Check,
  Loader2,
  Shield,
  Sparkles,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useApp } from "@/shared/contexts/app-context";
import { useTranslation } from "react-i18next";
import {
  getTierConfig,
  SubscriptionTier,
  SUBSCRIPTION_TRIAL_DAYS,
} from "@/shared/constants/subscription.constants";
import { createSubscriptionCheckout } from "@/features/payments/services/stripe-checkout";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/utils/debug";

interface SubscriptionCheckoutProps {
  tier: SubscriptionTier;
  billingCycle: "monthly" | "annual";
  onBillingCycleChange: (cycle: "monthly" | "annual") => void;
}

export function SubscriptionCheckout({
  tier,
  billingCycle,
  onBillingCycleChange,
}: SubscriptionCheckoutProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcher = useQueryFetcher<{
    isEligible: boolean;
    hasUsedFreeTrial: boolean;
    isInTrial: boolean;
  }>();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  const { data: trialEligibilityData } = useQuery({
    queryKey: queryKeys.api.trialEligibility(),
    queryFn: () => fetcher("/api/subscriptions/trial-eligibility"),
    enabled: !!user,
  });

  const trialEligible = trialEligibilityData?.isEligible ?? false;

  const handleCheckout = async () => {
    if (!tier || !user) {
      setError(t("checkout_error_invalid_tier"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check if user already has an active subscription
      try {
        const subData = await authenticatedFetchJson<{
          tier: string | null;
          billingCycle: string | null;
        }>("/api/subscriptions/current");
        if (subData.tier) {
          setError(t("checkout_existing_subscription_error"));
          setIsProcessing(false);
          return;
        }
      } catch (err) {
        // If check fails, continue (might be first subscription)
        debugLog.error(
          "Failed to check existing subscription:",
          {
            service: "subscription-checkout",
            operation: "checkExistingSubscription",
          },
          err
        );
      }

      const tierConfig = getTierConfig(tier, billingCycle);
      if (!tierConfig.stripePriceId) {
        setError(t("checkout_error_tier_not_configured"));
        setIsProcessing(false);
        return;
      }

      // Use trial eligibility from SWR (already fetched)
      const isEligibleForTrial = trialEligible;

      // Use client-side subscription checkout (preferred approach)
      // This uses real-time Firestore listening via onSnapshot
      const baseUrl = window.location.origin;

      // Only include trial_period_days if user is eligible
      const trialPeriodDays =
        isEligibleForTrial && SUBSCRIPTION_TRIAL_DAYS > 0
          ? SUBSCRIPTION_TRIAL_DAYS
          : undefined;

      const result = await createSubscriptionCheckout(
        user.uid,
        tierConfig.stripePriceId,
        {
          success_url: `${baseUrl}/payment/success?type=subscription&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/payment/cancel`,
          trial_period_days: trialPeriodDays,
          metadata: {
            userId: user.uid,
            tier: tier,
            billingCycle: billingCycle,
            userEmail: user.email || "",
          },
        }
      );

      if (result.url) {
        // Use window.location.assign instead of direct assignment for React hooks compliance
        window.location.assign(result.url);
      } else if (result.error) {
        const errorMessage =
          result.error.message || "Failed to create checkout session";
        setError(errorMessage);
        setIsProcessing(false);
      } else {
        setError(t("checkout_error_failed_session"));
        setIsProcessing(false);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("checkout_error_occurred");
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  const tierConfig = getTierConfig(tier, billingCycle);
  const monthlyConfig = getTierConfig(tier, "monthly");
  const annualConfig = getTierConfig(tier, "annual");
  // Only show trial if user is eligible
  const showTrial = trialEligible === true && SUBSCRIPTION_TRIAL_DAYS > 0;

  // Calculate annual savings percentage
  const monthlyTotal = monthlyConfig.price * 12;
  const annualSavings = monthlyTotal - annualConfig.price;
  const savingsPercentage = Math.round((annualSavings / monthlyTotal) * 100);

  return (
    <>
      <ErrorAlert error={error} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Checkout Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Billing Cycle Toggle */}
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-medium">
                  {t("account_subscription_billing_cycle")}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={billingCycle === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onBillingCycleChange("monthly")}
                  >
                    {t("subscription_monthly")}
                  </Button>
                  <Button
                    variant={billingCycle === "annual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onBillingCycleChange("annual")}
                  >
                    {t("subscription_annual")}
                    {savingsPercentage > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-2 bg-green-500/10 text-green-700"
                      >
                        {t("checkout_save_percentage", {
                          percentage: savingsPercentage,
                        })}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
              {billingCycle === "annual" && savingsPercentage > 0 && (
                <p className="text-base text-muted-foreground">
                  {t("checkout_save_amount", {
                    amount: annualSavings.toFixed(2),
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Selected Plan */}
          <Card className="border-2 bg-gradient-to-br from-primary/5 to-purple-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl mb-2">
                    {tierConfig.name} {t("account_tabs_subscription_short")}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {tierConfig.billingCycle === "monthly"
                      ? t("checkout_billed_monthly")
                      : t("checkout_billed_annually")}
                  </CardDescription>
                </div>
                <Badge className="bg-primary text-primary-foreground px-4 py-1.5 text-base">
                  {t("checkout_selected")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Display */}
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-bold">
                  ${tierConfig.price.toFixed(2)}
                </span>
                <span className="text-2xl text-muted-foreground">
                  {billingCycle === "monthly"
                    ? t("checkout_per_month")
                    : t("checkout_per_year")}
                </span>
                {billingCycle === "annual" && (
                  <span className="text-base text-muted-foreground">
                    {t("checkout_monthly_equivalent", {
                      amount: (tierConfig.price / 12).toFixed(2),
                    })}
                  </span>
                )}
                {showTrial && (
                  <Badge variant="secondary" className="ml-auto">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {t("checkout_day_trial", { days: SUBSCRIPTION_TRIAL_DAYS })}
                  </Badge>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3 pt-4 border-t">
                <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("checkout_whats_included")}
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base">
                      <span className="font-semibold">
                        {tierConfig.features.maxReelsPerMonth === -1
                          ? t("studio_unlimited")
                          : tierConfig.features.maxReelsPerMonth.toLocaleString()}
                      </span>{" "}
                      reels per month
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base">
                      AI-powered content generation
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base">
                      {tierConfig.features.instagramPublishing
                        ? "Instagram publishing"
                        : "Export & save content"}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base">
                      {t("account_subscription_support_level", {
                        level:
                          tierConfig.features.supportLevel
                            .charAt(0)
                            .toUpperCase() +
                          tierConfig.features.supportLevel.slice(1),
                      })}
                    </span>
                  </li>
                  {tierConfig.features.apiAccess && (
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-base">
                        {t("checkout_api_access_included")}
                      </span>
                    </li>
                  )}
                  {tierConfig.features.customBranding && (
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-base">
                        {t("checkout_custom_branding_available")}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Security & Trust */}
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">
                    {t("checkout_secure_payment_processing")}
                  </p>
                  <p className="text-base text-muted-foreground">
                    {t("checkout_payment_processed_securely")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24 border-2">
            <CardHeader>
              <CardTitle>{t("order_detail_order_summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pricing Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-base">
                  <span className="text-muted-foreground">
                    {t("account_tabs_subscription_short")}
                  </span>
                  <span className="font-medium">{tierConfig.name}</span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="text-muted-foreground">
                    {t("checkout_billing")}
                  </span>
                  <span className="font-medium capitalize">{billingCycle}</span>
                </div>
                {billingCycle === "annual" && savingsPercentage > 0 && (
                  <div className="flex items-center justify-between text-base pt-2 border-t">
                    <span className="text-muted-foreground">
                      {t("checkout_annual_savings")}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-green-500/10 text-green-700"
                    >
                      Save ${annualSavings.toFixed(2)} per year with annual
                      billing
                    </Badge>
                  </div>
                )}
                {showTrial && (
                  <div className="flex items-center justify-between text-base pt-2 border-t">
                    <span className="text-muted-foreground">
                      {t("checkout_trial_period")}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-green-500/10 text-green-700"
                    >
                      {t("checkout_days_free", {
                        days: SUBSCRIPTION_TRIAL_DAYS,
                      })}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold">
                    {t("admin_contact_messages_total")}
                  </span>
                  <div className="text-right">
                    {showTrial ? (
                      <div className="space-y-1">
                        <div className="text-3xl font-bold">$0.00</div>
                        <div className="text-base text-muted-foreground line-through">
                          ${tierConfig.price.toFixed(2)}
                          {billingCycle === "monthly"
                            ? t("checkout_per_month")
                            : t("checkout_per_year")}
                        </div>
                        <div className="text-sm text-green-600 font-medium">
                          {t("checkout_first_days_free", {
                            days: SUBSCRIPTION_TRIAL_DAYS,
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-3xl font-bold">
                        ${tierConfig.price.toFixed(2)}
                        <span className="text-base text-muted-foreground font-normal">
                          {billingCycle === "monthly"
                            ? t("checkout_per_month")
                            : t("checkout_per_year")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {showTrial && (
                  <p className="text-sm text-muted-foreground">
                    After trial: ${tierConfig.price.toFixed(2)}
                    {billingCycle === "monthly"
                      ? t("checkout_per_month")
                      : t("checkout_per_year")}
                  </p>
                )}
              </div>

              {/* CTA Button */}
              <Button
                className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                onClick={handleCheckout}
                disabled={isProcessing}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t("checkout_processing")}
                  </>
                ) : showTrial ? (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    {t("home_hero_cta_start_trial")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    {t("checkout_subscribe_securely")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {/* Trust Indicators */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>{t("checkout_cancel_anytime")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>{t("common_14_day_money_back_guarantee")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>{t("checkout_no_hidden_fees")}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  {t("checkout_accepted_payment_methods")}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-sm">
                    Visa
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Mastercard
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Amex
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Stripe
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
