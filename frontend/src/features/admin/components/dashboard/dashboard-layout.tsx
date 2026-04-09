"use client";

import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApp } from "@/shared/contexts/app-context";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Code,
  Mail,
  CreditCard,
  HelpCircle,
  Database,
  Music,
  Settings2,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { Dialog } from "@/shared/components/ui/dialog";
import { HelpModal } from "@/features/admin/components/dashboard/help-modal";
import { cn } from "@/shared/utils/helpers/utils";

// ─── Nav items ────────────────────────────────────────────────────────────────

interface AdminNavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

function useAdminNavItems(): AdminNavItem[] {
  const { t } = useTranslation();
  return [
    {
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      label: t("admin_help_dashboard_section"),
    },
    { href: "/admin/niches", icon: Database, label: "Niches & Scraping" },
    { href: "/admin/music", icon: Music, label: "Music Library" },
    {
      href: "/admin/subscriptions",
      icon: CreditCard,
      label: t("metadata_admin_subscriptions_title"),
    },
    {
      href: "/admin/orders",
      icon: ShoppingCart,
      label: t("metadata_admin_orders_title"),
    },
    {
      href: "/admin/customers",
      icon: Users,
      label: t("metadata_admin_customers_title"),
    },
    {
      href: "/admin/contactmessages",
      icon: Mail,
      label: t("admin_nav_messages"),
    },
    {
      href: "/admin/system-config",
      icon: Settings2,
      label: t("admin_nav_system_config"),
    },
    {
      href: "/admin/developer",
      icon: Code,
      label: t("admin_help_developer_section"),
    },
  ];
}

function isNavActive(href: string, pathname: string): boolean {
  if (href === "/admin/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// ─── Page title (for section header in non-dashboard pages) ──────────────────

function capitalizeWords(text: string): string {
  return text
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getPageTitle(
  pathname: string,
  navItems: AdminNavItem[],
  t: (key: string) => string
): string {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.label;

  const parent = navItems
    .filter((item) => {
      const normalized = item.href.endsWith("/") ? item.href : `${item.href}/`;
      return pathname.startsWith(normalized) && item.href !== pathname;
    })
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (parent) {
    const sub = pathname
      .substring(parent.href.length)
      .replace(/^\//, "")
      .replace(/-/g, " ");
    return sub ? `${parent.label}: ${capitalizeWords(sub)}` : parent.label;
  }

  const last = pathname.split("/").pop() || "";
  return (
    capitalizeWords(last.replace(/-/g, " ")) ||
    t("admin_help_dashboard_section")
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function AdminSidebarPanel({
  pathname,
  onHelpOpen,
}: {
  pathname: string;
  onHelpOpen: () => void;
}) {
  const { t } = useTranslation();
  const { user, profile, logout } = useApp();
  const navigate = useNavigate();
  const adminNavItems = useAdminNavItems();

  const name = profile?.name || user?.displayName || "Admin";
  const email = profile?.email || user?.email || "";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "AD";

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border">
      <div className="flex flex-col gap-6 p-5 h-full">
        {/* Identity */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/[0.10] dark:bg-amber-500/[0.08] border border-amber-500/[0.25] dark:border-amber-500/[0.15] flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
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

          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 dark:border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
            Admin
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5">
          {adminNavItems.map(({ href, icon: Icon, label }) => {
            const active = isNavActive(href, pathname);
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-overlay-sm text-foreground"
                    : "text-dim-2 hover:text-dim-1 hover:bg-overlay-xs"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-amber-600 dark:text-amber-400" : ""
                  )}
                />
                <span
                  className={cn("font-medium", active ? "text-foreground" : "")}
                >
                  {label}
                </span>
              </Link>
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
            <ArrowUpRight className="h-4 w-4 shrink-0 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
            <span>Back to Studio</span>
          </Link>
          <button
            onClick={onHelpOpen}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-2 hover:text-dim-1 hover:bg-overlay-xs transition-colors text-left"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>{t("common_help")}</span>
          </button>
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

// ─── Mobile nav ───────────────────────────────────────────────────────────────

function AdminMobileNav({ pathname }: { pathname: string }) {
  const { user, profile } = useApp();
  const adminNavItems = useAdminNavItems();

  const name = profile?.name || user?.displayName || "Admin";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "AD";

  return (
    <div className="md:hidden border-b border-border px-4 pt-4 pb-0">
      {/* Identity strip */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/[0.10] dark:bg-amber-500/[0.08] border border-amber-500/[0.25] dark:border-amber-500/[0.15] flex items-center justify-center">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
            {initials}
          </span>
        </div>
        <p className="text-sm font-semibold truncate">{name}</p>
        <div className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 dark:border-amber-500/20">
          <div className="w-1 h-1 rounded-full bg-amber-600 dark:bg-amber-400" />
          Admin
        </div>
      </div>

      {/* Scrolling tab row */}
      <div className="flex overflow-x-auto gap-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {adminNavItems.map(({ href, icon: Icon, label }) => {
          const active = isNavActive(href, pathname);
          return (
            <Link
              key={href}
              to={href}
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
                  active ? "text-amber-600 dark:text-amber-400" : ""
                )}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const adminNavItems = useAdminNavItems();
  const [helpOpen, setHelpOpen] = useState(false);

  const isDashboard =
    pathname === "/admin/dashboard" ||
    pathname === "/admin" ||
    pathname === "/admin/";

  const pageTitle = getPageTitle(pathname, adminNavItems, t);

  return (
    <div className="h-screen bg-studio-bg text-studio-fg font-studio overflow-hidden flex">
      <AdminSidebarPanel
        pathname={pathname}
        onHelpOpen={() => setHelpOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AdminMobileNav pathname={pathname} />

        {/* Section header (desktop only, dashboard skips it) */}
        {!isDashboard && (
          <div className="hidden md:block px-8 pt-7 pb-0">
            <h2 className="text-base font-semibold text-foreground">
              {pageTitle}
            </h2>
            <div className="mt-5 h-px bg-border" />
          </div>
        )}

        <main className="flex-1 p-5 md:px-8 md:py-7">{children}</main>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <HelpModal />
      </Dialog>
    </div>
  );
}
