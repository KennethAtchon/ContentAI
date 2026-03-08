/**
 * Dashboard View - Modern SaaS Design
 *
 * Main admin dashboard view with metrics, analytics, and quick access to key sections.
 */

"use client";

import {
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { RecentOrdersList } from "@/features/admin/components/orders/recent-orders-list";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useApp } from "@/shared/contexts/app-context";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useTranslation } from "react-i18next";

interface CustomersCountResponse {
  totalCustomers: number;
  percentChange: number | null;
}

interface ConversionResponse {
  conversionRate: number;
  percentChange: number | null;
}

interface RevenueResponse {
  totalRevenue: number;
  percentChange: number | null;
}

interface SubscriptionsResponse {
  activeSubscriptions: number;
  mrr: number;
  churnRate: number;
  arpu: number;
}

const CURRENCY_FORMAT_OPTIONS = {
  style: "currency" as const,
  currency: "USD",
  maximumFractionDigits: 0,
};

const PERCENTAGE_DECIMAL_PLACES = 1;
const DASHBOARD_LIST_LIMIT = 5;

interface MetricCardProps {
  title: string;
  icon: React.ElementType;
  value: string | number;
  change: string;
  loading: boolean;
  error: string | null;
  formatValue?: (value: any) => string;
}

function MetricCard({
  title,
  icon: Icon,
  value,
  change,
  loading,
  error,
  formatValue,
  loadingText,
}: MetricCardProps & { loadingText?: string }) {
  const displayValue =
    formatValue && typeof value === "number" ? formatValue(value) : value;

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-2xl font-bold text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {loadingText || "Loading..."}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">
              {displayValue}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{change}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface TabSectionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  linkHref: string;
  linkText: string;
  children: React.ReactNode;
}

function TabSection({
  title,
  description,
  icon: Icon,
  linkHref,
  linkText,
  children,
}: TabSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        </div>
        <Button asChild variant="outline" className="shadow-sm">
          <Link to={linkHref}>{linkText}</Link>
        </Button>
      </div>
      {children}
    </div>
  );
}

export function DashboardView() {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher();

  // Admin layout wraps with AuthGuard; user is guaranteed when this renders.
  const enabled = !!user;

  const formatPercentageChange = (percentChange: number | null): string => {
    if (percentChange === null) {
      return t("admin_dashboard_no_comparison_data");
    }

    const sign = percentChange > 0 ? "+" : "";
    return `${sign}${percentChange.toFixed(PERCENTAGE_DECIMAL_PLACES)}%`;
  };

  const {
    data: customersData,
    error: customersError,
    isLoading: customersLoading,
  } = useQuery({
    queryKey: queryKeys.api.admin.customersCount(),
    queryFn: () =>
      fetcher("/api/users/customers-count") as Promise<CustomersCountResponse>,
    enabled,
  });

  const {
    data: conversionData,
    error: conversionError,
    isLoading: conversionLoading,
  } = useQuery({
    queryKey: queryKeys.api.admin.conversion(),
    queryFn: () =>
      fetcher("/api/admin/analytics") as Promise<ConversionResponse>,
    enabled,
  });

  const {
    data: revenueData,
    error: revenueError,
    isLoading: revenueLoading,
  } = useQuery({
    queryKey: queryKeys.api.admin.revenue(),
    queryFn: () =>
      fetcher("/api/customer/orders/total-revenue") as Promise<RevenueResponse>,
    enabled,
  });

  const {
    data: subscriptionsData,
    error: subscriptionsError,
    isLoading: subscriptionsLoading,
  } = useQuery({
    queryKey: queryKeys.api.admin.subscriptionsAnalytics(),
    queryFn: () =>
      fetcher(
        "/api/admin/subscriptions/analytics"
      ) as Promise<SubscriptionsResponse>,
    enabled,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          {t("common_dashboard_overview")}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t(
            "common_monitor_your_business_performance_and_track_key_metrics_at_a"
          )}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={t("admin_dashboard_monthly_recurring_revenue_label")}
          icon={DollarSign}
          value={subscriptionsData?.mrr ?? 0}
          change={t("admin_dashboard_subscription_revenue")}
          loading={subscriptionsLoading}
          error={
            subscriptionsError instanceof Error
              ? subscriptionsError.message
              : subscriptionsError
                ? String(subscriptionsError)
                : null
          }
          loadingText={t("subscription_manage_loading")}
          formatValue={(value: number) =>
            value.toLocaleString("en-US", CURRENCY_FORMAT_OPTIONS)
          }
        />

        <MetricCard
          title={t("admin_dashboard_active_subscriptions_label")}
          icon={CreditCard}
          value={subscriptionsData?.activeSubscriptions ?? 0}
          change={t("admin_dashboard_currently_active")}
          loading={subscriptionsLoading}
          error={
            subscriptionsError instanceof Error
              ? subscriptionsError.message
              : subscriptionsError
                ? String(subscriptionsError)
                : null
          }
          loadingText={t("subscription_manage_loading")}
          formatValue={(value: number) => value.toLocaleString()}
        />

        <MetricCard
          title={t("admin_dashboard_average_revenue_per_user")}
          icon={TrendingUp}
          value={subscriptionsData?.arpu ?? 0}
          change={`Churn: ${subscriptionsData?.churnRate?.toFixed(2) ?? 0}%`}
          loading={subscriptionsLoading}
          error={
            subscriptionsError instanceof Error
              ? subscriptionsError.message
              : subscriptionsError
                ? String(subscriptionsError)
                : null
          }
          loadingText={t("subscription_manage_loading")}
          formatValue={(value: number) =>
            value.toLocaleString("en-US", CURRENCY_FORMAT_OPTIONS)
          }
        />

        <MetricCard
          title={t("admin_dashboard_total_customers")}
          icon={Users}
          value={customersData?.totalCustomers ?? 0}
          change={formatPercentageChange(customersData?.percentChange ?? null)}
          loading={customersLoading}
          error={
            customersError instanceof Error
              ? customersError.message
              : customersError
                ? String(customersError)
                : null
          }
          loadingText={t("subscription_manage_loading")}
          formatValue={(value: number) => value.toLocaleString()}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <MetricCard
          title={t("admin_dashboard_conversion_rate")}
          icon={TrendingUp}
          value={`${conversionData?.conversionRate ?? 0}%`}
          change={formatPercentageChange(conversionData?.percentChange ?? null)}
          loading={conversionLoading}
          error={
            conversionError instanceof Error
              ? conversionError.message
              : conversionError
                ? String(conversionError)
                : null
          }
          loadingText={t("subscription_manage_loading")}
        />

        <MetricCard
          title={t("admin_dashboard_total_revenue")}
          icon={DollarSign}
          value={revenueData?.totalRevenue ?? 0}
          change={formatPercentageChange(revenueData?.percentChange ?? null)}
          loading={revenueLoading}
          error={
            revenueError instanceof Error
              ? revenueError.message
              : revenueError
                ? String(revenueError)
                : null
          }
          loadingText={t("subscription_manage_loading")}
          formatValue={(value: number) =>
            value.toLocaleString("en-US", CURRENCY_FORMAT_OPTIONS)
          }
        />
      </div>

      {/* Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TabSection
          title={t("admin_dashboard_recent_orders")}
          description={t(
            "common_review_latest_customer_orders_and_transactions"
          )}
          icon={DollarSign}
          linkHref="/admin/orders"
          linkText={t("admin_dashboard_view_all_orders")}
        >
          <Card className="border-2">
            <CardContent className="pt-6">
              <RecentOrdersList limit={DASHBOARD_LIST_LIMIT} />
            </CardContent>
          </Card>
        </TabSection>

        <TabSection
          title={t("metadata_admin_subscriptions_title")}
          description={t("common_view_and_manage_customer_subscriptions")}
          icon={CreditCard}
          linkHref="/admin/subscriptions"
          linkText={t("admin_dashboard_view_all_subscriptions")}
        >
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {subscriptionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : subscriptionsError ? (
                  <div className="flex items-center gap-2 text-sm text-destructive py-8">
                    <AlertCircle className="h-4 w-4" />
                    {subscriptionsError instanceof Error
                      ? subscriptionsError.message
                      : String(subscriptionsError)}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("admin_dashboard_active_subscriptions_label")}
                      </span>
                      <span className="text-2xl font-bold">
                        {subscriptionsData?.activeSubscriptions ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("admin_dashboard_monthly_recurring_revenue_label")}
                      </span>
                      <span className="text-lg font-semibold">
                        {subscriptionsData?.mrr?.toLocaleString(
                          "en-US",
                          CURRENCY_FORMAT_OPTIONS
                        ) ?? "$0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("admin_dashboard_churn_rate")}
                      </span>
                      <span className="text-lg font-semibold">
                        {subscriptionsData?.churnRate?.toFixed(2) ?? 0}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabSection>
      </div>
    </div>
  );
}
