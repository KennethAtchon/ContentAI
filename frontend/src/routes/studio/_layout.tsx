import React from "react";
import {
  Outlet,
  createFileRoute,
  Link,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApp } from "@/shared/contexts/app-context";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { ScopedErrorBoundary } from "@/shared/components/layout/error-boundary";
import { cn } from "@/shared/utils/helpers/utils";
import { getTierDisplay } from "@/features/account/components/account-helpers";
import { APP_NAME } from "@/shared/constants/app.constants";
import {
  Telescope,
  Sparkles,
  LayoutList,
  Film,
  LogOut,
  User,
  Shield,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

// ─── Nav items ────────────────────────────────────────────────────────────────

const STUDIO_NAV_ITEMS = [
  {
    key: "discover",
    path: "/studio/discover",
    icon: Telescope,
    labelKey: "studio_tabs_discover",
  },
  {
    key: "generate",
    path: "/studio/generate",
    icon: Sparkles,
    labelKey: "studio_tabs_generate",
  },
  {
    key: "queue",
    path: "/studio/queue",
    icon: LayoutList,
    labelKey: "studio_tabs_queue",
  },
  {
    key: "editor",
    path: "/studio/editor",
    icon: Film,
    labelKey: "studio_tabs_editor",
  },
] as const;

function isNavActive(path: string, pathname: string): boolean {
  return pathname === path || pathname.startsWith(path + "/");
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function StudioTopBar({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const { user, profile, logout, isAdmin } = useApp();
  const { role } = useSubscription();
  const navigate = useNavigate();

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

  return (
    <header className="h-[52px] shrink-0 bg-studio-bg border-b border-border flex items-center px-4 gap-0">
      {/* Logo */}
      <Link
        to="/studio/discover"
        className="flex items-center gap-2 pr-4 border-r border-border mr-3 no-underline hover:opacity-90 transition-opacity shrink-0"
      >
        <div className="w-6 h-6 bg-gradient-to-br from-studio-accent to-studio-purple rounded-[7px] flex items-center justify-center text-sm shrink-0">
          ✦
        </div>
        <span className="text-sm font-bold text-foreground tracking-[-0.3px] hidden sm:inline">
          {APP_NAME}
        </span>
      </Link>

      {/* Nav pills */}
      <nav className="flex items-center gap-0.5">
        {STUDIO_NAV_ITEMS.map(({ key, path, icon: Icon, labelKey }) => {
          const active = isNavActive(path, pathname);
          return (
            <Link
              key={key}
              to={path}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors no-underline",
                active
                  ? "bg-overlay-sm text-foreground"
                  : "text-dim-2 hover:text-dim-1 hover:bg-overlay-xs"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-studio-accent" : ""
                )}
              />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Right: tier badge + user dropdown */}
      <div className="flex items-center gap-2.5">
        {/* Tier badge — desktop only */}
        <div
          className={cn(
            "hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium",
            tier.badgeClass
          )}
        >
          <div className={cn("w-1.5 h-1.5 rounded-full", tier.dotClass)} />
          {tier.label}
        </div>

        <ThemeToggle />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-overlay-xs transition-colors group">
              <div className="w-7 h-7 rounded-lg bg-[hsl(234_89%_74%/0.08)] border border-[hsl(234_89%_74%/0.15)] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[hsl(234_89%_74%)]">
                  {initials}
                </span>
              </div>
              <span className="hidden md:block text-sm font-medium text-dim-1 max-w-[96px] truncate">
                {name}
              </span>
              <ChevronDown className="hidden md:block h-3.5 w-3.5 text-dim-3 group-hover:text-dim-2 transition-colors shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link
                to="/account"
                className="flex items-center gap-2.5 no-underline cursor-pointer"
              >
                <User className="h-4 w-4 shrink-0" />
                {t("navigation_account")}
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-2.5 no-underline cursor-pointer"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  {t("navigation_admin")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout().then(() => navigate({ to: "/" }))}
              className="text-red-400/80 focus:text-red-400 focus:bg-red-500/[0.06] cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0 mr-2.5" />
              {t("common_sign_out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function StudioPageLayout() {
  const location = useLocation();

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio flex flex-col overflow-hidden">
        <StudioTopBar pathname={location.pathname} />
        <main className="flex-1 min-h-0 overflow-hidden">
          <ScopedErrorBoundary
            title="Something went wrong in Studio"
            description="Refresh the page to retry this studio screen."
            className="h-full"
          >
            <Outlet />
          </ScopedErrorBoundary>
        </main>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/_layout")({
  component: StudioPageLayout,
});
