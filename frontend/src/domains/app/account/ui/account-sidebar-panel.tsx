import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Package,
  User,
  SlidersHorizontal,
  ArrowUpRight,
  LogOut,
  Shield,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/state/auth-context";
import { useProfile } from "@/app/state/profile-context";
import { useSubscription } from "@/domains/subscriptions/hooks/use-subscription";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { cn } from "@/shared/lib/utils";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { getTierDisplay, isUnlimited, UsageBar } from "./account-helpers";
import type { Section, SidebarUsage } from "../model";

export function SidebarPanel({
  activeSection,
  onNavigate,
}: {
  activeSection: Section;
  onNavigate: (s: Section) => void;
}) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { profile, isAdmin } = useProfile();
  const navigate = useNavigate();
  const { role } = useSubscription();
  const fetcher = useQueryFetcher<SidebarUsage>();

  const { data: usage } = useQuery<SidebarUsage>({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => fetcher("/api/customer/usage"),
    enabled: !!user,
  });

  const name = profile?.name || user?.displayName || "—";
  const email = profile?.email || user?.email || "—";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const tier = getTierDisplay(role);

  const navItems: {
    id: Section;
    icon: React.FC<{ className?: string }>;
    label: string;
  }[] = [
    {
      id: "overview",
      icon: LayoutDashboard,
      label: t("account_tabs_overview"),
    },
    {
      id: "subscription",
      icon: CreditCard,
      label: t("account_tabs_subscription"),
    },
    { id: "usage", icon: TrendingUp, label: t("account_tabs_usage") },
    { id: "orders", icon: Package, label: t("metadata_admin_orders_title") },
    {
      id: "preferences",
      icon: SlidersHorizontal,
      label: t("account_tabs_preferences"),
    },
    { id: "profile", icon: User, label: t("account_tabs_profile") },
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border">
      <div className="flex flex-col gap-6 p-5 h-full">
        {/* Identity */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[hsl(234_89%_74%/0.08)] border border-[hsl(234_89%_74%/0.15)] flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[hsl(234_89%_74%)]">
                {initials}
              </span>
            </div>
            <div className="min-w-0 pt-0.5 flex-1">
              <p className="font-semibold text-sm leading-tight truncate text-foreground">
                {name}
              </p>
              <p className="text-[11px] text-dim-2 truncate mt-0.5">{email}</p>
            </div>
            <ThemeToggle />
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium",
              tier.badgeClass
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", tier.dotClass)} />
            {tier.label} Plan
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Usage compact */}
        {usage && (
          <>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
                {t("account_tabs_usage")}
              </p>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-dim-2">
                    {t("account_overview_reels_analyzed")}
                  </span>
                  <span className="text-[11px] text-dim-1 tabular-nums">
                    {usage.reelsAnalyzed}
                    <span className="text-dim-3">
                      /
                      {isUnlimited(usage.reelsAnalyzedLimit)
                        ? "∞"
                        : usage.reelsAnalyzedLimit}
                    </span>
                  </span>
                </div>
                {!isUnlimited(usage.reelsAnalyzedLimit) && (
                  <UsageBar
                    value={usage.reelsAnalyzed}
                    max={usage.reelsAnalyzedLimit}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-dim-2">
                    {t("account_overview_content_generated")}
                  </span>
                  <span className="text-[11px] text-dim-1 tabular-nums">
                    {usage.contentGenerated}
                    <span className="text-dim-3">
                      /
                      {isUnlimited(usage.contentGeneratedLimit)
                        ? "∞"
                        : usage.contentGeneratedLimit}
                    </span>
                  </span>
                </div>
                {!isUnlimited(usage.contentGeneratedLimit) && (
                  <UsageBar
                    value={usage.contentGenerated}
                    max={usage.contentGeneratedLimit}
                  />
                )}
              </div>
            </div>

            <div className="h-px bg-border" />
          </>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5">
          {navItems.map(({ id, icon: Icon, label }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  active
                    ? "bg-overlay-sm text-foreground"
                    : "text-dim-2 hover:text-dim-1 hover:bg-overlay-xs"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-[hsl(234_89%_74%)]" : ""
                  )}
                />
                <span
                  className={cn("font-medium", active ? "text-foreground" : "")}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="h-px bg-border" />

        {/* Bottom actions */}
        <div className="space-y-0.5">
          <Link
            to="/studio/discover"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-2 hover:text-dim-1 hover:bg-overlay-xs transition-colors group"
          >
            <ArrowUpRight className="h-4 w-4 shrink-0 group-hover:text-[hsl(234_89%_74%)] transition-colors" />
            <span>{t("navigation_discover")}</span>
          </Link>
          {isAdmin && (
            <button
              onClick={() => navigate({ to: "/admin/dashboard" })}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-2 hover:text-dim-1 hover:bg-overlay-xs transition-colors text-left"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>{t("navigation_admin")}</span>
            </button>
          )}
          <button
            onClick={() => logout().then(() => navigate({ to: "/" }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-3 hover:text-red-400/80 hover:bg-red-500/[0.06] transition-colors text-left"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t("common_sign_out")}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
