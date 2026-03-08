import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Zap } from "lucide-react";
import { useApp } from "@/shared/contexts/app-context";
import { useTranslation } from "react-i18next";
import { useCalculator } from "@/features/calculator/hooks/use-calculator";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import type { CalculationType } from "@/features/calculator/types/calculator.types";
import {
  getAllCalculatorConfigs,
  getCalculatorIcon,
} from "@/features/calculator/constants/calculator.constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { ErrorAlert } from "@/shared/components/custom-ui/error-alert";
import { Button } from "@/shared/components/ui/button";
import { getCalculatorComponent } from "@/features/calculator/components/calculator-component-map";
import { FeatureGate } from "@/features/subscriptions/components/feature-gate";
import { UpgradePrompt } from "@/features/subscriptions/components/upgrade-prompt";
import { UsageMeter } from "@/shared/components/saas/UsageMeter";
import { ManageSubscriptionButton } from "@/features/subscriptions/components/manage-subscription-button";

export function CalculatorInteractive() {
  const { t } = useTranslation();
  const { user } = useApp();
  const { role } = useSubscription();
  const { usageStats, usageLimitReached } = useCalculator();
  const [selectedCalculator, setSelectedCalculator] =
    useState<CalculationType>("mortgage");

  if (!user) {
    return (
      <Card className="mx-auto max-w-md border-2">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {t("calculator_access_required")}
          </CardTitle>
          <CardDescription>
            {t(
              "common_please_sign_in_to_access_our_professional_calculator_suite"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full h-11">
            <Link to="/sign-in">{t("navigation_signIn")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-11">
            <Link to="/pricing">{t("common_view_pricing_plans")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {usageStats && (
        <Card className="mb-6 border-2 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("calculator_monthly_usage")}
                </p>
                <p className="text-2xl font-bold">
                  {usageStats.currentUsage} /{" "}
                  {usageStats.usageLimit === null
                    ? "∞"
                    : usageStats.usageLimit.toLocaleString()}
                </p>
              </div>
              {usageStats.usageLimit !== null && (
                <div className="flex-1 max-w-md">
                  <UsageMeter
                    currentUsage={usageStats.currentUsage}
                    usageLimit={usageStats.usageLimit}
                  />
                </div>
              )}
              {usageStats.usageLimit === null && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-1.5">
                  <Zap className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {t("calculator_unlimited")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {usageLimitReached && role && (
        <div className="mb-6">
          <ErrorAlert
            error={t("calculator_reached_limit")}
            className="border-2"
          />
          <div className="mt-2 flex justify-end">
            <ManageSubscriptionButton variant="outline" size="sm">
              {t("account_subscription_manage_subscription")}
            </ManageSubscriptionButton>
          </div>
        </div>
      )}

      <Card className="border-2">
        <CardContent className="p-6">
          <Tabs
            value={selectedCalculator}
            onValueChange={(value) =>
              setSelectedCalculator(value as CalculationType)
            }
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/50">
              {getAllCalculatorConfigs().map((config) => {
                const Icon = getCalculatorIcon(config.id);
                return (
                  <TabsTrigger
                    key={config.id}
                    value={config.id}
                    className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{config.shortName}</span>
                    <span className="sm:hidden">{config.mobileLabel}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {getAllCalculatorConfigs().map((config) => {
              const CalculatorComponent = getCalculatorComponent(config.id);
              const requiredTier = config.tierRequirement;
              const Icon = getCalculatorIcon(config.id);

              return (
                <TabsContent key={config.id} value={config.id} className="mt-6">
                  <FeatureGate
                    requiredTier={requiredTier}
                    fallback={
                      <UpgradePrompt
                        requiredTier={requiredTier}
                        featureName={config.name}
                        featureDescription={config.longDescription}
                        icon={Icon}
                      />
                    }
                  >
                    <CalculatorComponent />
                  </FeatureGate>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
