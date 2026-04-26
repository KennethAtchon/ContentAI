"use client";

import { useEffect, useState, startTransition } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/state/auth-context";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/debug";
import { Loader2 } from "lucide-react";
import {
  isAuthRoute,
  getUnauthenticatedRedirect,
} from "@/shared/navigation/redirect-util";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Force a specific auth type, otherwise auto-detects from pathname */
  authType?: "admin" | "user";
  /** List of public routes that don't require authentication (relative paths) */
  publicRoutes?: string[];
}

interface VerificationState {
  isVerified: boolean;
  isVerifying: boolean;
  skipAuthentication: boolean;
}

const INITIAL_VERIFICATION_STATE: VerificationState = {
  isVerified: false,
  isVerifying: true,
  skipAuthentication: false,
};

/**
 * Determines if the current route is a public route
 */
function isPublicRoute(pathname: string, publicRoutes?: string[]): boolean {
  if (!publicRoutes || publicRoutes.length === 0) return false;
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  );
}

/**
 * Unified authentication guard component that automatically detects
 * whether a route requires admin or user authentication based on the pathname.
 *
 * - Admin routes (/admin/*): Requires admin verification via /api/admin/verify
 * - Customer routes (/(customer)/*): Requires user authentication
 * - Auth routes (/sign-in, /sign-up): No protection (allows access)
 */
export function AuthGuard({
  children,
  authType,
  publicRoutes,
}: AuthGuardProps) {
  const { t } = useTranslation();
  const { user, authLoading: loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [verificationState, setVerificationState] = useState<VerificationState>(
    INITIAL_VERIFICATION_STATE
  );
  const { authenticatedFetch } = useAuthenticatedFetch();

  // Determine auth type from pathname if not explicitly provided
  const requiresAdmin = authType === "admin";
  const requiresUser = authType === "user";

  useEffect(() => {
    // Skip auth routes (sign-in, sign-up) and public routes
    if (isAuthRoute(pathname) || isPublicRoute(pathname, publicRoutes)) {
      startTransition(() => {
        setVerificationState({
          isVerified: false,
          isVerifying: false,
          skipAuthentication: true,
        });
      });
      return;
    }

    async function verifyAccess() {
      if (loading) return;

      // User authentication check

      if (requiresUser && !requiresAdmin) {
        if (!user) {
          debugLog.info(t("auth_no_user_found_redirecting_to_signin"), {
            service: "auth-guard",
            pathname,
          });

          // Use the improved redirect utility with loop prevention
          const redirectConfig = getUnauthenticatedRedirect(pathname, false);
          navigate({
            to: redirectConfig.path,
            search: redirectConfig.search,
          });
          return;
        }

        // User is authenticated
        setVerificationState({
          isVerified: true,
          isVerifying: false,
          skipAuthentication: false,
        });
        return;
      }

      // Admin authentication check
      if (requiresAdmin) {
        if (!user) {
          debugLog.info(
            "No user found for admin route, redirecting to sign-in",
            {
              service: "auth-guard",
              pathname,
            }
          );

          // Use the improved redirect utility with loop prevention
          const redirectConfig = getUnauthenticatedRedirect(pathname, false);
          navigate({
            to: redirectConfig.path,
            search: redirectConfig.search,
          });
          return;
        }

        try {
          // Check Firebase custom claims first (no API call needed)
          // getIdTokenResult() returns the decoded token with claims already parsed
          const tokenResult = await user.getIdTokenResult(true); // Force refresh to get latest claims

          // Check if user has admin role in custom claims
          if (tokenResult.claims.role === "admin") {
            debugLog.info("Admin verification successful via custom claims", {
              service: "auth-guard",
              userId: user.uid,
              pathname,
            });
            setVerificationState({
              isVerified: true,
              isVerifying: false,
              skipAuthentication: false,
            });
            return;
          }

          // If no admin claim, verify via API (fallback for edge cases)
          debugLog.info("No admin claim found, verifying via API", {
            service: "auth-guard",
            userId: user.uid,
            pathname,
          });

          const response = await authenticatedFetch("/api/admin/verify");

          if (response.ok) {
            debugLog.info("Admin verification successful via API", {
              service: "auth-guard",
              userId: user.uid,
              pathname,
            });
            // Force token refresh to get updated claims
            await user.getIdToken(true);
            setVerificationState({
              isVerified: true,
              isVerifying: false,
              skipAuthentication: false,
            });
          } else {
            debugLog.warn("Admin verification failed", {
              service: "auth-guard",
              status: response.status,
              userId: user.uid,
              pathname,
            });
            // Redirect to admin verification page with the intended destination
            navigate({
              to: "/admin/verify",
              search: { redirect: pathname },
            });
          }
        } catch (error) {
          debugLog.error(
            "Admin verification error",
            {
              service: "auth-guard",
              userId: user.uid,
              pathname,
            },
            error
          );
          // Redirect to admin verification page with the intended destination
          navigate({
            to: "/admin/verify",
            search: { redirect: pathname },
          });
        }
        return;
      }

      // No auth required (shouldn't reach here, but handle gracefully)
      setVerificationState({
        isVerified: true,
        isVerifying: false,
        skipAuthentication: false,
      });
    }

    verifyAccess();
  }, [
    user,
    loading,
    navigate,
    pathname,
    requiresAdmin,
    requiresUser,
    authenticatedFetch,
    publicRoutes,
    t,
  ]);

  // Show loading spinner while authentication state is being determined
  if (loading || verificationState.isVerifying) {
    const loadingMessage = requiresAdmin
      ? t("auth_loading_admin_dashboard")
      : t("subscription_manage_loading");

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-600" />
          <p className="text-base text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // If skipAuthentication is false, we need to check if the user is verified
  if (!verificationState.skipAuthentication && !verificationState.isVerified) {
    return null;
  }

  return children;
}
