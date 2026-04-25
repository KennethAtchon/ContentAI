/**
 * Subscription Management Component
 *
 * Component for managing user subscriptions including viewing current tier,
 * usage statistics, and cancellation. Plan changes are handled via Stripe Customer Portal.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import { Badge } from "@/shared/ui/primitives/badge";
import { Alert, AlertDescription } from "@/shared/ui/primitives/alert";
import { Progress } from "@/shared/ui/primitives/progress";
import { ErrorAlert } from "@/shared/ui/feedback/error-alert";
import { ManageSubscriptionButton } from "@/domains/subscriptions/ui/manage-subscription-button";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useSubscriptionManagement } from "../hooks/use-subscription-management";

export function SubscriptionManagement() {
  const { t } = useTranslation();
  const { error, hasEnterpriseAccess, loading, role, tierConfig, usageStats } =
    useSubscriptionManagement();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!role) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("account_subscription_no_active")}</CardTitle>
          <CardDescription>
            {t("common_subscribe_to_a_plan_to_access_the_studio_features")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/pricing">{t("common_view_pricing_plans")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeTierConfig = tierConfig;
  if (!activeTierConfig) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ErrorAlert error={error?.message ?? undefined} />

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              {t("account_subscription_current_plan")}
              <Badge variant="default">
                {t("account_subscription_active")}
              </Badge>
            </CardTitle>
            <CardDescription>
              {t("account_subscription_plan_price", {
                name: activeTierConfig.name,
                price: activeTierConfig.price,
                billingCycle: activeTierConfig.billingCycle,
              })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-base text-muted-foreground">
                {t("account_subscription_billing_cycle")}
              </p>
              <p className="text-xl font-semibold capitalize">
                {activeTierConfig.billingCycle}
              </p>
            </div>
            {usageStats?.resetDate && (
              <div>
                <p className="text-base text-muted-foreground">
                  {t("account_subscription_next_billing_date")}
                </p>
                <p className="text-xl font-semibold">
                  {new Date(usageStats.resetDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usageStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("account_subscription_usage_this_month")}
            </CardTitle>
            <CardDescription>
              {usageStats.usageLimit === null
                ? t("account_subscription_unlimited_calculations_feature")
                : t("account_subscription_calculations_used", {
                    current: usageStats.currentUsage,
                    limit: usageStats.usageLimit,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageStats.usageLimit !== null && (
              <>
                <Progress
                  value={usageStats.percentageUsed}
                  className={`h-2 ${usageStats.percentageUsed >= 100 ? "[&>div]:bg-destructive" : usageStats.percentageUsed >= 80 ? "[&>div]:bg-amber-500" : ""}`}
                />
                <div className="flex items-center justify-between text-base">
                  <span className="text-muted-foreground">
                    {t("account_subscription_percent_used", {
                      percentage: usageStats.percentageUsed,
                    })}
                  </span>
                  {usageStats.resetDate && (
                    <span className="text-muted-foreground">
                      {t("account_subscription_resets_on")}{" "}
                      {new Date(usageStats.resetDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            )}

            {usageStats &&
              (usageStats.limitReached || usageStats.percentageUsed >= 100) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {hasEnterpriseAccess
                      ? t("account_subscription_reached_limit_maxPlan")
                      : t("account_subscription_reached_limit_upgrade")}
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      )}

      {/* Plan Features */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account_subscription_plan_features")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-base">
                {activeTierConfig.features.maxReelsPerMonth === -1
                  ? t("account_subscription_unlimited_calculations_feature")
                  : t("account_subscription_reels_per_month", {
                      count: activeTierConfig.features.maxReelsPerMonth,
                    })}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-base">
                {t("account_subscription_content_types")}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-base">
                {activeTierConfig.features.instagramPublishing
                  ? t("account_subscription_feature_instagram_publishing")
                  : t("account_subscription_feature_export_save")}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-base">
                {t("account_subscription_support_level", {
                  level: activeTierConfig.features.supportLevel,
                })}
              </span>
            </li>
            {activeTierConfig.features.apiAccess && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-base">
                  {t("account_subscription_api_access")}
                </span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Billing Actions */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("account_subscription_billing_subscription")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ManageSubscriptionButton className="w-full">
            {t("account_subscription_manage_subscription")}
          </ManageSubscriptionButton>
          <p className="text-sm text-muted-foreground">
            {t("account_subscription_manage_stripe_portal")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
