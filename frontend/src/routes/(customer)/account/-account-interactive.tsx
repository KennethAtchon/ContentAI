import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  CreditCard,
  TrendingUp,
  Package,
  User,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { SubscriptionManagement } from "@/features/account/components/subscription-management";
import { UsageDashboard } from "@/features/account/components/usage-dashboard";
import { ProfileEditor } from "@/features/account/components/profile-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function StudioOverview() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">
            {t("account_overview_title")}
          </CardTitle>
          <CardDescription>{t("account_overview_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">—</p>
              <p className="text-base text-muted-foreground mt-1">
                {t("account_overview_reels_analyzed")}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">—</p>
              <p className="text-base text-muted-foreground mt-1">
                {t("account_overview_content_generated")}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">—</p>
              <p className="text-base text-muted-foreground mt-1">
                {t("account_overview_queue_items")}
              </p>
            </div>
          </div>
          <div className="text-center">
            <Button asChild size="lg" className="px-8">
              <Link to="/studio/discover">
                {t("account_overview_open_studio")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccountInteractive() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/50">
        <TabsTrigger
          value="overview"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">{t("account_tabs_overview")}</span>
          <span className="sm:hidden">{t("account_tabs_overview_short")}</span>
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

      <TabsContent value="overview" className="space-y-6 mt-6">
        <StudioOverview />
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
            <CardTitle className="text-xl">
              {t("account_orders_history")}
            </CardTitle>
            <CardDescription>
              {t("common_view_your_past_orders_and_subscriptions")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-medium text-foreground mb-2">
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
