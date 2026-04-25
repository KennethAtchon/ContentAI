import { Badge } from "@/shared/ui/primitives/badge";
import { Button } from "@/shared/ui/primitives/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { ArrowRight, Check, Loader2, Lock, Sparkles } from "lucide-react";
import { SUBSCRIPTION_TRIAL_DAYS } from "@/shared/constants/subscription.constants";
import type { SubscriptionSummaryProps } from "../subscription-checkout.types";

export function SubscriptionSummaryCard({
  tierConfig,
  billingCycle,
  showTrial,
  annualSavings,
  savingsPercentage,
  isProcessing,
  onCheckout,
  t,
}: SubscriptionSummaryProps) {
  return (
    <Card className="sticky top-24 border-2">
      <CardHeader>
        <CardTitle>{t("order_detail_order_summary")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
                Save ${annualSavings.toFixed(2)} per year with annual billing
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
                {t("checkout_days_free", { days: SUBSCRIPTION_TRIAL_DAYS })}
              </Badge>
            </div>
          )}
        </div>

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

        <Button
          className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          onClick={onCheckout}
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
  );
}
