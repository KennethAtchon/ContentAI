"use client";

import { Link } from "@tanstack/react-router";
import {
  Users,
  CreditCard,
  ShoppingCart,
  Database,
  Mail,
  Settings2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { RecentOrdersList } from "@/domains/admin/ui/orders/recent-orders-list";
import { AiCostDashboard } from "@/domains/admin/ui/dashboard/ai-cost-dashboard";
import { useApp } from "@/app/state/app-context";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { useTranslation } from "react-i18next";

// ─── Response types ───────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_FORMAT_OPTIONS = {
  style: "currency" as const,
  currency: "USD",
  maximumFractionDigits: 0,
};

const DASHBOARD_LIST_LIMIT = 5;

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex-1 bg-overlay-xs px-5 py-4 space-y-0.5 min-w-0">
      <p className="text-2xl font-bold tracking-tight text-foreground truncate">
        {value}
      </p>
      <p className="text-[11px] text-dim-2 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-dim-3">{sub}</p>}
    </div>
  );
}

function StatRowSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 flex-1 rounded-lg bg-overlay-xs animate-pulse"
        />
      ))}
    </div>
  );
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

export function DashboardView() {
  const { t } = useTranslation();
  const { user, profile } = useApp();
  const fetcher = useQueryFetcher();

  const enabled = !!user;

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: queryKeys.api.admin.customersCount(),
    queryFn: () =>
      fetcher("/api/users/customers-count") as Promise<CustomersCountResponse>,
    enabled,
  });

  const { data: conversionData, isLoading: conversionLoading } = useQuery({
    queryKey: queryKeys.api.admin.conversion(),
    queryFn: () =>
      fetcher("/api/admin/analytics") as Promise<ConversionResponse>,
    enabled,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: queryKeys.api.admin.revenue(),
    queryFn: () =>
      fetcher("/api/customer/orders/total-revenue") as Promise<RevenueResponse>,
    enabled,
  });

  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useQuery(
    {
      queryKey: queryKeys.api.admin.subscriptionsAnalytics(),
      queryFn: () =>
        fetcher(
          "/api/admin/subscriptions/analytics"
        ) as Promise<SubscriptionsResponse>,
      enabled,
    }
  );

  const name = profile?.name || user?.displayName || "";
  const firstName = name.split(" ")[0] || "there";

  const formatChange = (percentChange: number | null): string => {
    if (percentChange === null) return t("admin_dashboard_no_comparison_data");
    const sign = percentChange > 0 ? "+" : "";
    return `${sign}${percentChange.toFixed(1)}%`;
  };

  const primaryLoading = subscriptionsLoading || customersLoading;
  const secondaryLoading = conversionLoading || revenueLoading;

  const quickAccess = [
    {
      href: "/admin/customers",
      icon: Users,
      label: t("metadata_admin_customers_title"),
      desc: "Manage user accounts",
    },
    {
      href: "/admin/subscriptions",
      icon: CreditCard,
      label: t("metadata_admin_subscriptions_title"),
      desc: "Plans & billing",
    },
    {
      href: "/admin/orders",
      icon: ShoppingCart,
      label: t("metadata_admin_orders_title"),
      desc: "Purchase history",
    },
    {
      href: "/admin/niches",
      icon: Database,
      label: "Niches & Scraping",
      desc: "Content sources",
    },
    {
      href: "/admin/contactmessages",
      icon: Mail,
      label: t("admin_nav_messages"),
      desc: "User inquiries",
    },
    {
      href: "/admin/system-config",
      icon: Settings2,
      label: t("admin_nav_system_config"),
      desc: "App settings",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {firstName}.
        </h2>
        <p className="text-sm text-dim-2 mt-1">
          Here's your platform overview.
        </p>
      </div>

      {/* Primary stats row: MRR, Active Subs, Customers, Churn */}
      {primaryLoading ? (
        <StatRowSkeleton count={4} />
      ) : (
        <div className="flex gap-px border border-border rounded-xl overflow-hidden">
          <StatCell
            value={(subscriptionsData?.mrr ?? 0).toLocaleString(
              "en-US",
              CURRENCY_FORMAT_OPTIONS
            )}
            label={t("admin_dashboard_monthly_recurring_revenue_label")}
          />
          <StatCell
            value={(
              subscriptionsData?.activeSubscriptions ?? 0
            ).toLocaleString()}
            label={t("admin_dashboard_active_subscriptions_label")}
          />
          <StatCell
            value={(customersData?.totalCustomers ?? 0).toLocaleString()}
            label={t("admin_dashboard_total_customers")}
            sub={formatChange(customersData?.percentChange ?? null)}
          />
          <StatCell
            value={`${(subscriptionsData?.churnRate ?? 0).toFixed(2)}%`}
            label={t("admin_dashboard_churn_rate")}
          />
        </div>
      )}

      {/* Secondary stats row: Conversion, Total Revenue, ARPU */}
      {secondaryLoading ? (
        <StatRowSkeleton count={3} />
      ) : (
        <div className="flex gap-px border border-border rounded-xl overflow-hidden">
          <StatCell
            value={`${conversionData?.conversionRate ?? 0}%`}
            label={t("admin_dashboard_conversion_rate")}
            sub={formatChange(conversionData?.percentChange ?? null)}
          />
          <StatCell
            value={(revenueData?.totalRevenue ?? 0).toLocaleString(
              "en-US",
              CURRENCY_FORMAT_OPTIONS
            )}
            label={t("admin_dashboard_total_revenue")}
            sub={formatChange(revenueData?.percentChange ?? null)}
          />
          <StatCell
            value={(subscriptionsData?.arpu ?? 0).toLocaleString(
              "en-US",
              CURRENCY_FORMAT_OPTIONS
            )}
            label={t("admin_dashboard_average_revenue_per_user")}
          />
        </div>
      )}

      {/* Quick access */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quickAccess.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              to={href}
              className="group flex items-start gap-3 p-3.5 rounded-xl border border-border bg-overlay-xs hover:bg-border hover:border-border transition-colors"
            >
              <Icon className="h-4 w-4 text-dim-3 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-dim-1 group-hover:text-foreground transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-dim-3 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* AI Cost Breakdown */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
          AI Cost Breakdown
        </p>
        <AiCostDashboard />
      </div>

      {/* Recent Orders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
            {t("admin_dashboard_recent_orders")}
          </p>
          <Link
            to="/admin/orders"
            className="text-xs text-dim-2 hover:text-dim-1 transition-colors"
          >
            {t("admin_dashboard_view_all_orders")} →
          </Link>
        </div>
        <RecentOrdersList limit={DASHBOARD_LIST_LIMIT} />
      </div>
    </div>
  );
}
