import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Package,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "@/app/state/auth-context";
import { useProfile } from "@/app/state/profile-context";
import { useSubscription } from "@/domains/subscriptions/hooks/use-subscription";
import { cn } from "@/shared/lib/utils";
import { getTierDisplay } from "./account-helpers";
import type { Section } from "../model";

export function MobileNav({
  activeSection,
  onNavigate,
}: {
  activeSection: Section;
  onNavigate: (s: Section) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { role } = useSubscription();

  const name = profile?.name || user?.displayName || "—";
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
      label: t("account_tabs_overview_short"),
    },
    {
      id: "subscription",
      icon: CreditCard,
      label: t("account_tabs_subscription_short"),
    },
    { id: "usage", icon: TrendingUp, label: t("account_tabs_usage") },
    { id: "orders", icon: Package, label: "Orders" },
    {
      id: "preferences",
      icon: SlidersHorizontal,
      label: t("account_tabs_preferences_short"),
    },
    { id: "profile", icon: User, label: t("account_tabs_profile") },
  ];

  return (
    <div className="md:hidden border-b border-border px-4 pt-4 pb-0">
      {/* Mobile identity strip */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[hsl(234_89%_74%/0.08)] border border-[hsl(234_89%_74%/0.15)] flex items-center justify-center">
          <span className="text-xs font-bold text-[hsl(234_89%_74%)]">
            {initials}
          </span>
        </div>
        <p className="text-sm font-semibold truncate">{name}</p>
        <div
          className={cn(
            "ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
            tier.badgeClass
          )}
        >
          <div className={cn("w-1 h-1 rounded-full", tier.dotClass)} />
          {tier.label}
        </div>
      </div>

      {/* Scrolling tab row */}
      <div className="flex overflow-x-auto gap-1 pb-3 scrollbar-none">
        {navItems.map(({ id, icon: Icon, label }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors font-medium",
                active
                  ? "bg-overlay-sm text-foreground"
                  : "text-dim-2 hover:text-dim-1"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  active ? "text-[hsl(234_89%_74%)]" : ""
                )}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
