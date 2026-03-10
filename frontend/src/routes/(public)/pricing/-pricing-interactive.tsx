/**
 * Pricing Interactive Component - Client Component
 *
 * Handles interactive parts of pricing page: billing cycle toggle and subscription fetching
 */

"use client";

import { useState, lazy, Suspense } from "react";
import { PricingCard } from "@/shared/components/saas/PricingCard";
import {
  getTierConfig,
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_TRIAL_DAYS,
} from "@/shared/constants/subscription.constants";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

// Dynamically import FeatureComparison to reduce initial bundle size
const FeatureComparison = lazy(() =>
  import("@/shared/components/saas/FeatureComparison").then((mod) => ({
    default: mod.FeatureComparison,
  }))
);

interface PricingInteractiveProps {
  initialBillingCycle?: "monthly" | "annual";
}

// Calculate savings for annual billing
function getAnnualSavings(
  tier: (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS]
) {
  const monthlyConfig = getTierConfig(tier, "monthly");
  const annualConfig = getTierConfig(tier, "annual");
  const monthlyTotal = monthlyConfig.price * 12;
  const savings = monthlyTotal - annualConfig.price;
  const percentage = Math.round((savings / monthlyTotal) * 100);
  return { savings, percentage };
}

// Billing Cycle Toggle Component
export function PricingToggle({
  billingCycle,
  onBillingCycleChange,
}: {
  billingCycle: "monthly" | "annual";
  onBillingCycleChange: (cycle: "monthly" | "annual") => void;
}) {
  const basicSavings = getAnnualSavings(SUBSCRIPTION_TIERS.BASIC);
  const proSavings = getAnnualSavings(SUBSCRIPTION_TIERS.PRO);
  const enterpriseSavings = getAnnualSavings(SUBSCRIPTION_TIERS.ENTERPRISE);

  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <span
        className={`text-sm font-medium ${billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"}`}
      >
        Monthly
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onBillingCycleChange(
            billingCycle === "monthly" ? "annual" : "monthly"
          )
        }
        className="relative w-14 h-7 rounded-full"
        aria-label={`Switch to ${billingCycle === "monthly" ? "annual" : "monthly"} billing`}
        aria-pressed={billingCycle === "annual"}
      >
        <span
          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-primary transition-transform ${
            billingCycle === "annual" ? "translate-x-7" : "translate-x-0"
          }`}
          aria-hidden="true"
        />
      </Button>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${billingCycle === "annual" ? "text-foreground" : "text-muted-foreground"}`}
        >
          Annual
        </span>
        {(basicSavings.percentage > 0 ||
          proSavings.percentage > 0 ||
          enterpriseSavings.percentage > 0) && (
          <Badge
            variant="secondary"
            className="bg-green-500/10 text-green-700"
            aria-label={`Save up to ${Math.max(
              basicSavings.percentage,
              proSavings.percentage,
              enterpriseSavings.percentage
            )}% with annual billing`}
          >
            Save up to{" "}
            {Math.max(
              basicSavings.percentage,
              proSavings.percentage,
              enterpriseSavings.percentage
            )}
            %
          </Badge>
        )}
      </div>
    </div>
  );
}

// Pricing Cards Component
export function PricingCards({
  billingCycle,
}: {
  billingCycle: "monthly" | "annual";
}) {
  return (
    <div className="grid gap-8 md:grid-cols-3 lg:gap-10">
      <PricingCard
        tier={getTierConfig(SUBSCRIPTION_TIERS.BASIC, billingCycle)}
        tierKey={SUBSCRIPTION_TIERS.BASIC}
      />
      <PricingCard
        tier={getTierConfig(SUBSCRIPTION_TIERS.PRO, billingCycle)}
        tierKey={SUBSCRIPTION_TIERS.PRO}
        isPopular
      />
      <PricingCard
        tier={getTierConfig(SUBSCRIPTION_TIERS.ENTERPRISE, billingCycle)}
        tierKey={SUBSCRIPTION_TIERS.ENTERPRISE}
      />
    </div>
  );
}

// Feature Comparison Component
export function PricingFeatureComparison() {
  return (
    <section className="border-y py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Compare Plans
            </h2>
            <p className="text-lg text-muted-foreground">
              See what's included in each plan
            </p>
          </div>
          <Card className="border-2 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-pulse text-muted-foreground">
                      Loading comparison table...
                    </div>
                  </div>
                }
              >
                <FeatureComparison />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// Main component that manages state and renders everything
export function PricingInteractive({
  initialBillingCycle = "monthly",
}: PricingInteractiveProps) {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    initialBillingCycle
  );

  return (
    <>
      {/* Free Trial Banner */}
      <div className="container mb-8">
        <div className="mx-auto max-w-4xl">
          <Alert className="border-2 border-green-500/20 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10">
            <Sparkles className="h-5 w-5 text-green-600" />
            <AlertDescription className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-base text-foreground mb-1">
                  {t("common_all_plans_include_a_14_day_free_trial")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("common_try_reelstudio_risk_free")}
                </p>
              </div>
              <Badge className="bg-green-600 text-white px-4 py-1.5 text-sm font-semibold">
                {t("checkout_days_free", { days: SUBSCRIPTION_TRIAL_DAYS })}
              </Badge>
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="container">
        <div className="mx-auto max-w-4xl">
          <PricingToggle
            billingCycle={billingCycle}
            onBillingCycleChange={setBillingCycle}
          />
        </div>
      </div>

      {/* Cards Section - Full Width */}
      <section className="container py-16 md:py-24">
        <PricingCards billingCycle={billingCycle} />
      </section>

      {/* Feature Comparison */}
      <PricingFeatureComparison />
    </>
  );
}
