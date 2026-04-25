import { Button } from "@/shared/ui/primitives/button";
import { Badge } from "@/shared/ui/primitives/badge";
import { Card, CardContent } from "@/shared/ui/primitives/card";

interface BillingCycleCardProps {
  billingCycle: "monthly" | "annual";
  annualSavings: number;
  savingsPercentage: number;
  onBillingCycleChange: (cycle: "monthly" | "annual") => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function BillingCycleCard({
  billingCycle,
  annualSavings,
  savingsPercentage,
  onBillingCycleChange,
  t,
}: BillingCycleCardProps) {
  return (
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
            {t("checkout_save_amount", { amount: annualSavings.toFixed(2) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
