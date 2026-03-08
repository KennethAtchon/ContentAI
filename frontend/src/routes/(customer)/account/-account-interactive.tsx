import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  Calculator,
  CreditCard,
  TrendingUp,
  Package,
  User,
} from "lucide-react";
import { SubscriptionManagement } from "@/features/account/components/subscription-management";
import { UsageDashboard } from "@/features/account/components/usage-dashboard";
import { CalculatorInterface } from "@/features/account/components/calculator-interface";
import { ProfileEditor } from "@/features/account/components/profile-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";

export function AccountInteractive() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="calculator" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/50">
        <TabsTrigger
          value="calculator"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t("account_tabs_calculator")}
          </span>
          <span className="sm:hidden">
            {t("account_tabs_calculator_short")}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="subscription"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <CreditCard className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t("account_tabs_subscription")}
          </span>
          <span className="sm:hidden">
            {t("account_tabs_subscription_short")}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="usage"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <TrendingUp className="h-4 w-4" />
          {t("account_tabs_usage")}
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <Package className="h-4 w-4" />
          {t("metadata_admin_orders_title")}
        </TabsTrigger>
        <TabsTrigger
          value="profile"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <User className="h-4 w-4" />
          {t("account_tabs_profile")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calculator" className="space-y-6 mt-6">
        <CalculatorInterface />
      </TabsContent>

      <TabsContent value="subscription" className="space-y-6 mt-6">
        <SubscriptionManagement />
      </TabsContent>

      <TabsContent value="usage" className="space-y-6 mt-6">
        <UsageDashboard />
      </TabsContent>

      <TabsContent value="orders" className="space-y-6 mt-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">
              {t("account_orders_history")}
            </CardTitle>
            <CardDescription>
              {t("common_view_your_past_orders_and_subscriptions")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                {t("account_orders_no_orders")}
              </p>
              <p className="text-muted-foreground">
                {t(
                  "common_your_order_history_will_appear_here_once_you_make_a_purchase"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="profile" className="space-y-6 mt-6">
        <ProfileEditor />
      </TabsContent>
    </Tabs>
  );
}
