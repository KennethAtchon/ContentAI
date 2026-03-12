"use client";

import { useApp } from "@/shared/contexts/app-context";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Link, useNavigate } from "@tanstack/react-router";
import { User, LogOut, Home, Shield } from "lucide-react";
import { debugLog } from "@/shared/utils/debug";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";

// Constants
const AVATAR_SIZE = 8;
const DROPDOWN_WIDTH = 56;
const HOME_ROUTE = REDIRECT_PATHS.HOME;
const SIGN_IN_ROUTE = REDIRECT_PATHS.SIGN_IN;
const SIGN_UP_ROUTE = REDIRECT_PATHS.SIGN_UP;
const ACCOUNT_ROUTE = REDIRECT_PATHS.ACCOUNT;

/**
 * User button component with authentication state display and dropdown menu.
 * Shows sign-in/sign-up buttons for unauthenticated users or user avatar with menu for authenticated users.
 */
export default function UserButton() {
  const { t } = useTranslation();
  const { user, authLoading: loading, logout, isAdmin } = useApp();
  const navigate = useNavigate();

  /**
   * Handles user sign out with navigation.
   */
  const handleSignOut = async () => {
    try {
      await logout();
      navigate({ to: HOME_ROUTE });
      debugLog.info(t("auth_user_signed_out_successfully"), {
        service: "user-button",
        operation: "handleSignOut",
      });
    } catch (error) {
      debugLog.error(
        t("auth_sign_out_failed"),
        { service: "user-button", operation: "handleSignOut" },
        error
      );
    }
  };

  /**
   * Show loading skeleton while authentication state is being determined.
   */
  if (loading) {
    return (
      <div
        className={`w-${AVATAR_SIZE} h-${AVATAR_SIZE} bg-muted animate-pulse rounded-full`}
      />
    );
  }

  /**
   * Show sign-in/sign-up buttons for unauthenticated users.
   * Hidden on mobile as these options are available in the mobile menu.
   */
  if (!user) {
    return (
      <div className="hidden md:flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link to={SIGN_IN_ROUTE}>Sign In</Link>
        </Button>
        <Button asChild>
          <Link to={SIGN_UP_ROUTE}>Sign Up</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`relative h-${AVATAR_SIZE} w-${AVATAR_SIZE} rounded-full`}
        >
          <Avatar className={`h-${AVATAR_SIZE} w-${AVATAR_SIZE}`}>
            <AvatarImage
              src={user.photoURL || ""}
              alt={user.displayName || "User"}
            />
            <AvatarFallback>
              <img src="/assets/avatar.png" alt="Default avatar" className="w-full h-full object-cover rounded-full" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={`w-${DROPDOWN_WIDTH}`}
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <button
            onClick={() => navigate({ to: HOME_ROUTE })}
            className="w-full flex items-center cursor-pointer"
          >
            <Home className="mr-2 h-4 w-4" />
            <span>{t("navigation_home")}</span>
          </button>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <button
            onClick={() => navigate({ to: ACCOUNT_ROUTE })}
            className="w-full flex items-center cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            <span>{t("navigation_account") || "Account"}</span>
          </button>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <button
              onClick={() => navigate({ to: REDIRECT_PATHS.ADMIN_DASHBOARD })}
              className="w-full flex items-center cursor-pointer"
            >
              <Shield className="mr-2 h-4 w-4" />
              <span>{t("navigation_admin") || "Admin"}</span>
            </button>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("common_sign_out")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
