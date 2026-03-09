import { useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { useApp } from "@/shared/contexts/app-context";
import UserButton from "@/features/auth/components/user-button";
import { APP_NAME, CORE_FEATURE_PATH } from "@/shared/constants/app.constants";
import type { ShellVariant } from "@/shared/components/layout/studio-shell";

/* ── Tab definitions per variant ──────────────────────────────────────────── */

const STUDIO_TABS = [
  { key: "discover", path: "/studio/discover" },
  { key: "generate", path: "/studio/generate" },
  { key: "queue", path: "/studio/queue" },
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

/* ── Tab key → i18n mapping ───────────────────────────────────────────────── */

const TAB_LABELS: Record<string, string> = {
  discover: "studio_tabs_discover",
  generate: "studio_tabs_generate",
  queue: "studio_tabs_queue",
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

/* ── Component ────────────────────────────────────────────────────────────── */

interface Props {
  variant?: ShellVariant;
  niche?: string;
  onNicheChange?: (niche: string) => void;
  onScan?: () => void;
  activeTab: string;
}

export function StudioTopBar({
  variant = "studio",
  niche,
  onNicheChange,
  onScan,
  activeTab,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* Determine which tabs to show */
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

  /* Active detection */
  const isActive = (key: string, path: string) => {
    if (activeTab) return activeTab === key;
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="bg-studio-topbar border-b border-white/[0.06] flex items-center px-4 shrink-0 gap-0 font-studio relative z-50">
        {/* Logo */}
        <Link
          to={variant === "studio" ? "/studio/discover" : "/"}
          className="flex items-center gap-2 pr-5 border-r border-white/[0.06] mr-4 no-underline hover:opacity-90 transition-opacity"
        >
          <div className="w-6 h-6 bg-gradient-to-br from-studio-accent to-studio-purple rounded-[7px] flex items-center justify-center text-[11px] shrink-0">
            ✦
          </div>
          <span className="text-[14px] font-bold text-slate-100 tracking-[-0.3px] hidden sm:inline">
            {APP_NAME}
          </span>
        </Link>

        {/* Auth variant — back link */}
        {variant === "auth" && (
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[12px] text-slate-200/40 hover:text-slate-200/70 transition-colors no-underline font-studio"
          >
            ← {t("common_back_to_home")}
          </Link>
        )}

        {/* Tabs (desktop) */}
        {variant !== "auth" && (
          <nav className="hidden md:flex h-full">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => navigate({ to: tab.path })}
                className={cn(
                  "h-full px-4 flex items-center gap-1.5 text-[13px] font-medium transition-all duration-150",
                  "bg-transparent border-0 border-b-2 cursor-pointer font-studio",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-ring",
                  isActive(tab.key, tab.path)
                    ? "text-studio-accent border-b-studio-accent"
                    : "text-slate-200/40 border-b-transparent hover:text-slate-200/70",
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

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Studio: Search + Scan */}
          {variant === "studio" && niche !== undefined && (
            <>
              <input
                ref={inputRef}
                value={niche}
                onChange={(e) => onNicheChange?.(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onScan?.()}
                placeholder={t("studio_search_placeholder")}
                className={cn(
                  "w-44 bg-white/[0.05] border border-white/[0.08] rounded-lg",
                  "text-studio-fg text-[12px] px-3 py-1.5 outline-none font-studio",
                  "placeholder:text-slate-200/25 transition-colors duration-200",
                  "focus:border-studio-ring/50",
                )}
              />
              <button
                onClick={onScan}
                className={cn(
                  "bg-gradient-to-br from-studio-accent to-studio-purple",
                  "text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border-0",
                  "cursor-pointer transition-opacity duration-150 hover:opacity-85 font-studio",
                )}
              >
                {t("studio_search_scan")}
              </button>
            </>
          )}

          {/* Auth buttons for public */}
          {variant === "public" && !user && (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/sign-in"
                className="text-[12px] font-medium text-slate-200/50 hover:text-studio-fg transition-colors px-3 py-1.5 no-underline"
              >
                {t("navigation_signIn")}
              </Link>
              <Link
                to="/sign-up"
                className="bg-gradient-to-br from-studio-accent to-studio-purple text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-lg no-underline hover:opacity-85 transition-opacity"
              >
                {t("navigation_signUp")}
              </Link>
            </div>
          )}

          {/* User button for authenticated states */}
          {user && variant !== "auth" && <UserButton />}

          {/* Mobile hamburger */}
          {variant !== "auth" && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden bg-transparent border-0 text-slate-200/50 hover:text-studio-fg p-1.5 cursor-pointer"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          )}
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && variant !== "auth" && (
        <div className="md:hidden absolute top-[48px] left-0 w-full bg-studio-surface border-b border-white/[0.05] z-40 shadow-2xl">
          <nav className="flex flex-col p-3 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  navigate({ to: tab.path });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 text-[13px] font-medium rounded-lg",
                  "bg-transparent border-0 cursor-pointer font-studio transition-all",
                  isActive(tab.key, tab.path)
                    ? "bg-studio-accent/[0.08] text-studio-accent"
                    : "text-slate-200/40 hover:text-slate-200/70 hover:bg-white/[0.03]",
                )}
              >
                {t(TAB_LABELS[tab.key] ?? tab.key)}
              </button>
            ))}
            {variant === "public" && !user && (
              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-white/[0.05]">
                <Link
                  to="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-[12px] font-medium text-slate-200/50 py-2.5 rounded-lg border border-white/[0.08] no-underline hover:bg-white/[0.03]"
                >
                  {t("navigation_signIn")}
                </Link>
                <Link
                  to="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center bg-gradient-to-br from-studio-accent to-studio-purple text-white text-[12px] font-semibold py-2.5 rounded-lg no-underline hover:opacity-85"
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
