/**
 * Subscription Checkout Component
 *
 * Handles subscription checkout UI and logic.
 */

"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ErrorAlert } from "@/shared/ui/feedback/error-alert";
import {
  getTierConfig,
  SubscriptionTier,
  SUBSCRIPTION_TRIAL_DAYS,
} from "@/shared/constants/subscription.constants";
import { createSubscriptionCheckout } from "@/domains/payments/api/stripe-checkout";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { useAuth } from "@/app/state/auth-context";
import { debugLog } from "@/shared/debug";
import { BillingCycleCard } from "./subscription/BillingCycleCard";
import { SelectedPlanCard } from "./subscription/SelectedPlanCard";
import { SecurityCard } from "./subscription/SecurityCard";
import { SubscriptionSummaryCard } from "./subscription/SubscriptionSummaryCard";

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
  const { user } = useAuth();
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

  const tierConfig = getTierConfig(tier, billingCycle);
  const monthlyConfig = getTierConfig(tier, "monthly");
  const annualConfig = getTierConfig(tier, "annual");
  const showTrial = trialEligible === true && SUBSCRIPTION_TRIAL_DAYS > 0;
  const monthlyTotal = monthlyConfig.price * 12;
  const annualSavings = monthlyTotal - annualConfig.price;
  const savingsPercentage = Math.round((annualSavings / monthlyTotal) * 100);

  const handleCheckout = async () => {
    if (!tier || !user) {
      setError(t("checkout_error_invalid_tier"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
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
        debugLog.error(
          "Failed to check existing subscription:",
          {
            service: "subscription-checkout",
            operation: "checkExistingSubscription",
          },
          err
        );
      }

      if (!tierConfig.stripePriceId) {
        setError(t("checkout_error_tier_not_configured"));
        setIsProcessing(false);
        return;
      }

      const baseUrl = window.location.origin;
      const trialPeriodDays =
        trialEligible && SUBSCRIPTION_TRIAL_DAYS > 0
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
            tier,
            billingCycle,
            userEmail: user.email || "",
          },
        }
      );

      if (result.url) {
        window.location.assign(result.url);
        return;
      }

      setError(result.error?.message || t("checkout_error_failed_session"));
      setIsProcessing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("checkout_error_occurred")
      );
      setIsProcessing(false);
    }
  };

  return (
    <>
      <ErrorAlert error={error} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <BillingCycleCard
            billingCycle={billingCycle}
            annualSavings={annualSavings}
            savingsPercentage={savingsPercentage}
            onBillingCycleChange={onBillingCycleChange}
            t={t}
          />
          <SelectedPlanCard
            tierConfig={tierConfig}
            billingCycle={billingCycle}
            showTrial={showTrial}
            t={t}
          />
          <SecurityCard t={t} />
        </div>

        <div className="lg:col-span-1">
          <SubscriptionSummaryCard
            tierConfig={tierConfig}
            billingCycle={billingCycle}
            showTrial={showTrial}
            annualSavings={annualSavings}
            savingsPercentage={savingsPercentage}
            isProcessing={isProcessing}
            onCheckout={handleCheckout}
            t={t}
          />
        </div>
      </div>
    </>
  );
}
