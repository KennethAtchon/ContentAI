import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApp } from "@/app/state/app-context";
import UserButton from "@/domains/auth/ui/user-button";
import { APP_NAME } from "@/shared/constants/app.constants";
import { cn } from "@/shared/lib/utils";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import type { ShellVariant } from "./studio-shell";

const STUDIO_TABS = [
  { key: "discover", path: "/studio/discover" },
  { key: "generate", path: "/studio/generate" },
  { key: "queue", path: "/studio/queue" },
  { key: "editor", path: "/studio/editor" },
] as const;

const PUBLIC_TABS = [
  { key: "home", path: "/" },
  { key: "features", path: "/features" },
  { key: "pricing", path: "/pricing" },
  { key: "faq", path: "/faq" },
  { key: "contact", path: "/contact" },
] as const;

const CUSTOMER_TABS = [
  { key: "discover", path: "/studio/discover" },
  { key: "account", path: "/account" },
] as const;

const ADMIN_TABS = [
  { key: "dashboard", path: "/admin/dashboard" },
  { key: "customers", path: "/admin/customers" },
  { key: "settings", path: "/admin/settings" },
] as const;

const TAB_LABELS: Record<string, string> = {
  discover: "studio_tabs_discover",
  generate: "studio_tabs_generate",
  queue: "studio_tabs_queue",
  editor: "studio_tabs_editor",
  home: "navigation_home",
  features: "navigation_features",
  pricing: "metadata_pricing_title",
  faq: "faq_metadata_title",
  contact: "shared_footer_contact",
  account: "navigation_account",
  dashboard: "admin_dashboard",
  customers: "admin_customers",
  settings: "admin_settings",
};

interface StudioTopBarProps {
  variant?: ShellVariant;
  activeTab: string;
  niche?: string;
  onNicheChange?: (n: string) => void;
  onScan?: () => void;
}

export function StudioTopBar({
  variant = "studio",
  activeTab,
  niche: _niche,
  onNicheChange: _onNicheChange,
  onScan: _onScan,
}: StudioTopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs =
    variant === "studio"
      ? STUDIO_TABS
      : variant === "public"
        ? PUBLIC_TABS
        : variant === "customer"
          ? CUSTOMER_TABS
          : variant === "admin"
            ? ADMIN_TABS
            : [];

  const isActive = (key: string, path: string) => {
    if (activeTab) return activeTab === key;
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="bg-studio-topbar border-b border-overlay-sm flex items-center px-4 shrink-0 gap-0 font-studio relative z-50">
        <Link
          to={variant === "studio" ? "/studio/discover" : "/"}
          className="flex items-center gap-2 pr-5 border-r border-overlay-sm mr-4 no-underline hover:opacity-90 transition-opacity"
        >
          <div className="w-6 h-6 bg-gradient-to-br from-studio-accent to-studio-purple rounded-[7px] flex items-center justify-center text-sm shrink-0">
            ✦
          </div>
          <span className="text-base font-bold text-primary tracking-[-0.3px] hidden sm:inline">
            {APP_NAME}
          </span>
        </Link>

        {variant === "auth" && (
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-dim-2 hover:text-dim-1 transition-colors no-underline font-studio"
          >
            ← {t("common_back_to_home")}
          </Link>
        )}

        {variant !== "auth" && (
          <nav className="hidden md:flex h-full">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => navigate({ to: tab.path })}
                className={cn(
                  "h-full px-4 flex items-center gap-1.5 text-base font-medium transition-all duration-150",
                  "bg-transparent border-0 border-b-2 cursor-pointer font-studio",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-ring",
                  isActive(tab.key, tab.path)
                    ? "text-studio-accent border-b-studio-accent"
                    : "text-dim-2 border-b-transparent hover:text-dim-1"
                )}
              >
                {tab.key === "generate" && (
                  <span className="text-studio-accent">✦</span>
                )}
                {t(TAB_LABELS[tab.key] ?? tab.key)}
              </button>
            ))}
          </nav>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {variant === "public" && !user && (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/sign-in"
                className="text-sm font-medium text-dim-2 hover:text-studio-fg transition-colors px-3 py-1.5 no-underline"
              >
                {t("navigation_signIn")}
              </Link>
              <Link
                to="/sign-up"
                className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg no-underline hover:opacity-85 transition-opacity"
              >
                {t("navigation_signUp")}
              </Link>
            </div>
          )}

          <ThemeToggle />

          {user && variant !== "auth" && <UserButton />}

          {variant !== "auth" && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden bg-transparent border-0 text-dim-2 hover:text-studio-fg p-1.5 cursor-pointer"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          )}
        </div>
      </header>

      {mobileMenuOpen && variant !== "auth" && (
        <div className="md:hidden absolute top-[48px] left-0 w-full bg-studio-surface border-b border-overlay-sm z-40 shadow-2xl">
          <nav className="flex flex-col p-3 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  navigate({ to: tab.path });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 text-base font-medium rounded-lg",
                  "bg-transparent border-0 cursor-pointer font-studio transition-all",
                  isActive(tab.key, tab.path)
                    ? "bg-studio-accent/[0.08] text-studio-accent"
                    : "text-dim-2 hover:text-dim-1 hover:bg-overlay-xs"
                )}
              >
                {t(TAB_LABELS[tab.key] ?? tab.key)}
              </button>
            ))}
            {variant === "public" && !user && (
              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-overlay-sm">
                <Link
                  to="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-medium text-dim-2 py-2.5 rounded-lg border border-overlay-md no-underline hover:bg-overlay-xs"
                >
                  {t("navigation_signIn")}
                </Link>
                <Link
                  to="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold py-2.5 rounded-lg no-underline hover:opacity-85"
                >
                  {t("navigation_signUp")}
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
