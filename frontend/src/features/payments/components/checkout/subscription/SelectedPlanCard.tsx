import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import type { SubscriptionTierConfig } from "@/shared/constants/subscription.constants";
import { SUBSCRIPTION_TRIAL_DAYS } from "@/shared/constants/subscription.constants";

interface SelectedPlanCardProps {
  tierConfig: SubscriptionTierConfig;
  billingCycle: "monthly" | "annual";
  showTrial: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-base">{children}</span>
    </li>
  );
}

export function SelectedPlanCard({
  tierConfig,
  billingCycle,
  showTrial,
  t,
}: SelectedPlanCardProps) {
  return (
    <Card className="border-2 bg-gradient-to-br from-primary/5 to-purple-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl mb-1">
              {tierConfig.name} {t("account_tabs_subscription_short")}
            </CardTitle>
            <CardDescription>
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
        <div className="flex items-baseline gap-3">
          <span className="text-6xl font-bold">${tierConfig.price.toFixed(2)}</span>
          <span className="text-2xl text-muted-foreground">
            {billingCycle === "monthly" ? t("checkout_per_month") : t("checkout_per_year")}
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

        <div className="space-y-3 pt-4 border-t">
          <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
            {t("checkout_whats_included")}
          </p>
          <ul className="space-y-3">
            <FeatureItem>
              <span className="font-semibold">
                {tierConfig.features.maxReelsPerMonth === -1
                  ? t("studio_unlimited")
                  : tierConfig.features.maxReelsPerMonth.toLocaleString()}
              </span>{" "}
              reels per month
            </FeatureItem>
            <FeatureItem>AI-powered content generation</FeatureItem>
            <FeatureItem>
              {tierConfig.features.instagramPublishing ? "Instagram publishing" : "Export & save content"}
            </FeatureItem>
            <FeatureItem>
              {t("account_subscription_support_level", {
                level:
                  tierConfig.features.supportLevel.charAt(0).toUpperCase() +
                  tierConfig.features.supportLevel.slice(1),
              })}
            </FeatureItem>
            {tierConfig.features.apiAccess && (
              <FeatureItem>{t("checkout_api_access_included")}</FeatureItem>
            )}
            {tierConfig.features.customBranding && (
              <FeatureItem>{t("checkout_custom_branding_available")}</FeatureItem>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

