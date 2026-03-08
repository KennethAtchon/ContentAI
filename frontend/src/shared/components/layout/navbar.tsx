"use client";

import React, { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import UserButton from "@/features/auth/components/user-button";
import { useApp } from "@/shared/contexts/app-context";
import { Menu, X } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { APP_NAME } from "@/shared/constants/app.constants";
import { CORE_FEATURE_PATH } from "@/shared/constants/app.constants";

// Constants
const LOGO_PATH = "/logo.png";
const LOGO_ALT = `${APP_NAME} Logo`;

/**
 * Navigation types for better type safety.
 */
type NavigationLink = {
  href: string;
  label: string;
};

/**
 * Main navigation bar component with modern SaaS design.
 * Features mobile menu and dynamic navigation based on auth state.
 */
export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useApp();
  const { t } = useTranslation();

  // Navigation configuration - SaaS Calculator App
  const PUBLIC_NAVIGATION_LINKS: NavigationLink[] = [
    { href: "/", label: t("navigation_home") },
    { href: "/pricing", label: t("metadata_pricing_title") },
    { href: "/faq", label: t("faq_metadata_title") },
    { href: "/contact", label: t("shared_footer_contact") },
  ];

  const USER_ONLY_LINKS: NavigationLink[] = [
    { href: CORE_FEATURE_PATH, label: t("account_tabs_calculator") },
    { href: "/account", label: t("navigation_account") },
  ];

  // Build navigation links based on authentication state
  const navigationLinks: readonly NavigationLink[] = user
    ? [...PUBLIC_NAVIGATION_LINKS, ...USER_ONLY_LINKS]
    : PUBLIC_NAVIGATION_LINKS;

  /**
   * Determines if a navigation link is currently active.
   */
  const isLinkActive = (href: string): boolean => {
    if (href === "/") {
      return pathname === "/";
    }
    if (href === "/account" || href === CORE_FEATURE_PATH) {
      return pathname.startsWith(href);
    }
    return pathname === href;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 transition-transform hover:scale-105"
        >
          <img src={LOGO_PATH} alt={LOGO_ALT} className="h-8 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {navigationLinks.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                isLinkActive(href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {!user && (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link to="/sign-in">{t("navigation_signIn")}</Link>
              </Button>
              <Button asChild className="shadow-sm">
                <Link to="/sign-up">{t("navigation_signUp")}</Link>
              </Button>
            </div>
          )}
          {user && <UserButton />}
          <Button
            className="md:hidden"
            size="icon"
            variant="ghost"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={
              menuOpen
                ? t("shared_navbar_close_menu")
                : t("shared_navbar_open_menu")
            }
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      <MobileMenu
        isOpen={menuOpen}
        navigationLinks={navigationLinks}
        isAuthenticated={!!user}
        onLinkClick={() => setMenuOpen(false)}
        isLinkActive={isLinkActive}
      />
    </header>
  );
}

/**
 * Props for the MobileMenu component.
 */
interface MobileMenuProps {
  /** Whether the mobile menu is open */
  isOpen: boolean;
  /** Array of navigation links to display */
  navigationLinks: readonly NavigationLink[];
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Callback when a link is clicked */
  onLinkClick: () => void;
  /** Function to check if a link is active */
  isLinkActive: (href: string) => boolean;
}

/**
 * Mobile navigation menu component with modern SaaS styling.
 */
function MobileMenu({
  isOpen,
  navigationLinks,
  isAuthenticated,
  onLinkClick,
  isLinkActive,
}: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <nav className="md:hidden absolute top-16 left-0 w-full bg-background/95 backdrop-blur-md border-b shadow-lg z-50">
      <div className="flex flex-col p-4 space-y-1">
        {navigationLinks.map(({ href, label }) => (
          <Link
            key={href}
            to={href}
            onClick={onLinkClick}
            className={cn(
              "px-4 py-3 text-sm font-medium rounded-lg transition-all",
              isLinkActive(href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {label}
          </Link>
        ))}
        {!isAuthenticated && (
          <MobileMenuAuthButtons onLinkClick={onLinkClick} />
        )}
      </div>
    </nav>
  );
}

/**
 * Mobile menu authentication buttons with translations
 */
function MobileMenuAuthButtons({ onLinkClick }: { onLinkClick: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 pt-4 mt-4 border-t">
      <Button variant="outline" asChild className="w-full">
        <Link to="/sign-in" onClick={onLinkClick}>
          {t("navigation_signIn")}
        </Link>
      </Button>
      <Button asChild className="w-full shadow-sm">
        <Link to="/sign-up" onClick={onLinkClick}>
          {t("navigation_signUp")}
        </Link>
      </Button>
    </div>
  );
}
