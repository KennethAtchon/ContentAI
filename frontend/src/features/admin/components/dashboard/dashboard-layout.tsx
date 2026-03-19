/**
 * Dashboard Layout - Modern SaaS Design
 *
 * Modern admin dashboard layout with sidebar navigation and responsive design.
 */

"use client";

import React, { useState, useEffect, startTransition } from "react";
import { Link } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import UserButton from "@/features/auth/components/user-button";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Code,
  Mail,
  Menu,
  X,
  CreditCard,
  HelpCircle,
  Database,
  Music,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { HelpModal } from "@/features/admin/components/dashboard/help-modal";
import { Dialog } from "@/shared/components/ui/dialog";
import { cn } from "@/shared/utils/helpers/utils";

interface AdminNavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const BRAND_ICON = LayoutDashboard;

function useAdminNavItems(): AdminNavItem[] {
  const { t } = useTranslation();
  return [
    {
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      label: t("admin_help_dashboard_section"),
    },
    {
      href: "/admin/niches",
      icon: Database,
      label: "Niches & Scraping",
    },
    {
      href: "/admin/music",
      icon: Music,
      label: "Music Library",
    },
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
      href: "/admin/developer",
      icon: Code,
      label: t("admin_help_developer_section"),
    },
  ];
}

function findNavItemByPath(
  pathname: string,
  navItems: AdminNavItem[]
): AdminNavItem | undefined {
  return navItems.find((item) => item.href === pathname);
}

function findParentNavItem(
  pathname: string,
  navItems: AdminNavItem[]
): AdminNavItem | undefined {
  const parentMatches = navItems
    .filter((item) => {
      const normalizedHref = item.href.endsWith("/")
        ? item.href
        : `${item.href}/`;
      return pathname.startsWith(normalizedHref) && item.href !== pathname;
    })
    .sort((a, b) => b.href.length - a.href.length);

  return parentMatches[0];
}

function capitalizeWords(text: string): string {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createSubPageTitle(parentLabel: string, subPath: string): string {
  const cleanSubPath = subPath.replace(/^\//, "").replace(/-/g, " ");

  const capitalizedSubPath = capitalizeWords(cleanSubPath);

  return capitalizedSubPath
    ? `${parentLabel}: ${capitalizedSubPath}`
    : parentLabel;
}

function getPageTitle(
  pathname: string,
  navItems: AdminNavItem[],
  t: (key: string) => string
): string {
  const exactMatch = findNavItemByPath(pathname, navItems);
  if (exactMatch) {
    return exactMatch.label;
  }

  const parentMatch = findParentNavItem(pathname, navItems);
  if (parentMatch && pathname.startsWith(parentMatch.href)) {
    const subPath = pathname.substring(parentMatch.href.length);
    return createSubPageTitle(parentMatch.label, subPath);
  }

  if (pathname === "/admin/" || pathname === "/admin") {
    return navItems[0]?.label || t("admin_help_dashboard_section");
  }

  const pathParts = pathname.split("/");
  const lastPart = pathParts.pop() || "";
  const cleanPath = lastPart.replace(/-/g, " ");

  return (
    capitalizeWords(cleanPath) ||
    navItems[0]?.label ||
    t("admin_help_dashboard_section")
  );
}

interface SidebarProps {
  pathname: string;
}

function BrandHeader({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-16 items-center justify-between border-b border-overlay-sm bg-studio-surface px-6">
      <Link
        to="/admin/dashboard"
        className="flex items-center gap-3 font-bold text-xl"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-accent/15">
          <BRAND_ICON className="h-5 w-5 text-studio-accent" />
        </div>
        <span className="bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent">
          {t("admin_brand_name")}
        </span>
      </Link>
      {onClose && (
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

function NavigationLink({
  item,
  isActive,
}: {
  item: AdminNavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all",
        isActive
          ? "bg-studio-accent/[0.12] text-studio-accent"
          : "text-dim-2 hover:bg-overlay-sm hover:text-studio-fg"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{item.label}</span>
    </Link>
  );
}

function DesktopSidebar({ pathname }: SidebarProps) {
  const adminNavItems = useAdminNavItems();

  return (
    <div className="hidden w-64 flex-col border-r border-overlay-sm bg-studio-surface md:flex">
      <BrandHeader />
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-3">
          {adminNavItems.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>
      <div className="border-t border-border p-4">
        <UserButton />
      </div>
    </div>
  );
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
}

function MobileSidebar({ isOpen, onClose, pathname }: MobileSidebarProps) {
  const adminNavItems = useAdminNavItems();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-3/4 max-w-[270px] z-30 transform transition-transform duration-300 ease-in-out flex flex-col border-r border-overlay-sm bg-studio-surface shadow-xl md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <BrandHeader onClose={onClose} />
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-3">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all",
                  pathname === item.href
                    ? "bg-studio-accent/[0.12] text-studio-accent"
                    : "text-dim-2 hover:bg-overlay-sm hover:text-studio-fg"
                )}
                onClick={onClose}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-border p-4">
          <UserButton />
        </div>
      </div>
    </>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const adminNavItems = useAdminNavItems();

  const [layoutState, setLayoutState] = useState({
    mobileNavOpen: false,
    helpOpen: false,
  });

  const updateLayoutState = (updates: Partial<typeof layoutState>) => {
    setLayoutState((prev) => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    startTransition(() => {
      updateLayoutState({ mobileNavOpen: false });
    });
  }, [pathname]);

  useEffect(() => {
    const bodyStyle = document.body.style;
    bodyStyle.overflow = layoutState.mobileNavOpen ? "hidden" : "unset";

    return () => {
      bodyStyle.overflow = "unset";
    };
  }, [layoutState.mobileNavOpen]);

  return (
    <div className="flex h-screen bg-studio-bg">
      <DesktopSidebar pathname={pathname} />
      <MobileSidebar
        isOpen={layoutState.mobileNavOpen}
        onClose={() => updateLayoutState({ mobileNavOpen: false })}
        pathname={pathname}
      />

      <div className="flex flex-col overflow-hidden w-full">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-overlay-sm bg-studio-topbar/95 backdrop-blur-sm px-4 md:px-6">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => updateLayoutState({ mobileNavOpen: true })}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">
              {t("common_toggle_navigation_menu")}
            </span>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {getPageTitle(pathname, adminNavItems, t)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateLayoutState({ helpOpen: true })}
              className="hover:bg-muted"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">{t("common_help")}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <Dialog
        open={layoutState.helpOpen}
        onOpenChange={(open) => updateLayoutState({ helpOpen: open })}
      >
        <HelpModal />
      </Dialog>
    </div>
  );
}
