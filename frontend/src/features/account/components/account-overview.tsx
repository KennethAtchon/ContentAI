import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  CreditCard,
  User,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/shared/contexts/app-context";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/components/ui/button";
import { isUnlimited } from "./account-helpers";
import type { Section, SidebarUsage } from "../types";

export function StudioOverview({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { t } = useTranslation();
  const { user, profile } = useApp();
  const fetcher = useQueryFetcher<SidebarUsage>();

  const { data: usage, isLoading } = useQuery<SidebarUsage>({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => fetcher("/api/customer/usage"),
    enabled: !!user,
  });

  const name = profile?.name || user?.displayName || "";
  const firstName = name.split(" ")[0] || "there";

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {firstName}.
        </h2>
        <p className="text-sm text-dim-2 mt-1">
          {t("account_overview_subtitle")}
        </p>
      </div>

      {/* Stats row */}
      {isLoading ? (
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 flex-1 rounded-lg bg-overlay-xs animate-pulse"
            />
          ))}
        </div>
      ) : usage ? (
        <div className="flex gap-px border border-border rounded-xl overflow-hidden">
          {[
            {
              value: usage.reelsAnalyzed,
              limit: usage.reelsAnalyzedLimit,
              label: t("account_overview_reels_analyzed"),
            },
            {
              value: usage.contentGenerated,
              limit: usage.contentGeneratedLimit,
              label: t("account_overview_content_generated"),
            },
            {
              value: usage.queueSize,
              limit: usage.queueLimit,
              label: t("account_overview_queue_items"),
            },
          ].map((stat, i) => (
            <div key={i} className="flex-1 bg-overlay-xs px-5 py-4 space-y-0.5">
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {stat.value}
                <span className="text-base font-normal text-dim-3">
                  /{isUnlimited(stat.limit) ? "∞" : stat.limit}
                </span>
              </p>
              <p className="text-[11px] text-dim-2 leading-tight">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="default" className="gap-2">
          <Link to="/studio/discover">
            {t("account_overview_open_studio")}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={() => onNavigate("subscription")}
          className="text-dim-1 border-border hover:border-overlay-md"
        >
          {t("account_tabs_subscription")}
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={() => onNavigate("usage")}
          className="text-dim-2 hover:text-dim-1"
        >
          {t("account_tabs_usage")}
        </Button>
      </div>

      {/* Quick nav grid */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(
            [
              {
                id: "subscription" as Section,
                icon: CreditCard,
                label: t("account_tabs_subscription"),
                desc: "Manage your plan",
              },
              {
                id: "preferences" as Section,
                icon: SlidersHorizontal,
                label: t("account_tabs_preferences"),
                desc: "AI & video settings",
              },
              {
                id: "profile" as Section,
                icon: User,
                label: t("account_tabs_profile"),
                desc: "Name, email, contact",
              },
            ] as const
          ).map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="group flex items-start gap-3 p-3.5 rounded-xl border border-border bg-overlay-xs hover:bg-border hover:border-border transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-dim-3 group-hover:text-[hsl(234_89%_74%)] transition-colors mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-dim-1 group-hover:text-foreground transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-dim-3 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
