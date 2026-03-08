/**
 * Redirect Utility - Centralized Redirection Logic
 *
 * Provides smart, context-aware routing that considers user authentication status,
 * subscription status, and intended destination to provide optimal user experience.
 */

import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/shared/contexts/app-context";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { debugLog } from "@/shared/utils/debug";

/**
 * Centralized redirect paths
 */
export const REDIRECT_PATHS = {
  HOME: "/",
  PRICING: "/pricing",
  ACCOUNT: "/account",
  CHECKOUT: "/checkout",
  DASHBOARD: "/account?tab=calculator",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
} as const;

/**
 * User context types for smart routing
 */
export type UserContext =
  | "new_user"
  | "returning_user_no_subscription"
  | "returning_user_with_subscription"
  | "authenticated_user";

/**
 * Get user context based on authentication and subscription status
 */
function getUserContext(
  isAuthenticated: boolean,
  hasSubscription: boolean,
  isNewUser?: boolean
): UserContext {
  if (!isAuthenticated) {
    return isNewUser ? "new_user" : "authenticated_user";
  }

  if (hasSubscription) {
    return "returning_user_with_subscription";
  }

  return "returning_user_no_subscription";
}

/**
 * Determine optimal redirect destination based on user context and intent
 */
function getOptimalRedirect(
  userContext: UserContext,
  intendedDestination?: string,
  currentPath?: string
): string {
  // If user has a specific intended destination and it's appropriate for their context
  if (
    intendedDestination &&
    isDestinationAppropriate(userContext, intendedDestination)
  ) {
    return intendedDestination;
  }

  // Default routing based on user context
  switch (userContext) {
    case "new_user":
      // New users should go to pricing to understand the product
      return REDIRECT_PATHS.PRICING;

    case "returning_user_no_subscription":
      // Users without subscription should see pricing or checkout
      if (currentPath?.includes("pricing")) {
        return REDIRECT_PATHS.CHECKOUT;
      }
      return REDIRECT_PATHS.PRICING;

    case "returning_user_with_subscription":
      // Users with subscription should go to their dashboard
      return REDIRECT_PATHS.DASHBOARD;

    case "authenticated_user":
      // Authenticated users go to homepage by default
      return REDIRECT_PATHS.HOME;

    default:
      return REDIRECT_PATHS.HOME;
  }
}

/**
 * Check if a destination is appropriate for the user's context
 */
function isDestinationAppropriate(
  userContext: UserContext,
  destination: string
): boolean {
  // Public routes that are always appropriate
  const publicRoutes = [REDIRECT_PATHS.HOME, REDIRECT_PATHS.PRICING];
  if (publicRoutes.includes(destination as any)) {
    return true;
  }

  // Routes that require authentication
  const protectedRoutes = [
    REDIRECT_PATHS.ACCOUNT,
    REDIRECT_PATHS.DASHBOARD,
    REDIRECT_PATHS.CHECKOUT,
  ];
  if (protectedRoutes.includes(destination as any)) {
    return userContext !== "new_user" && userContext !== "authenticated_user";
  }

  return true; // Allow other routes by default
}

/**
 * Prevent redirect loops by checking if we're already at the target
 */
function wouldCreateRedirectLoop(
  currentPath: string,
  destination: string
): boolean {
  // Normalize paths for comparison
  const normalizedCurrent = currentPath.split("?")[0];
  const normalizedDest = destination.split("?")[0];

  return normalizedCurrent === normalizedDest;
}

/**
 * Smart redirect hook that provides context-aware navigation
 */
export function useSmartRedirect() {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();
  const { role, hasBasicAccess } = useSubscription();

  /**
   * Perform a smart redirect based on user context
   */
  const smartRedirect = (
    options: {
      intendedDestination?: string;
      forceRedirect?: boolean;
      isNewUser?: boolean;
    } = {}
  ) => {
    const {
      intendedDestination,
      forceRedirect = false,
      isNewUser = false,
    } = options;

    const currentPath = window.location.pathname;
    const hasSubscription = hasBasicAccess && !!role;
    const userContext = getUserContext(
      isAuthenticated,
      hasSubscription,
      isNewUser
    );

    const destination = intendedDestination
      ? getOptimalRedirect(userContext, intendedDestination, currentPath)
      : getOptimalRedirect(userContext, undefined, currentPath);

    // Prevent redirect loops unless forced
    if (!forceRedirect && wouldCreateRedirectLoop(currentPath, destination)) {
      debugLog.info("Redirect loop prevented", {
        service: "smart-redirect",
        currentPath,
        destination,
        userContext,
      });
      return false;
    }

    debugLog.info("Smart redirect executed", {
      service: "smart-redirect",
      currentPath,
      destination,
      userContext,
      hasSubscription,
      isAuthenticated,
    });

    navigate({ to: destination });
    return true;
  };

  /**
   * Redirect to authentication with proper return URL
   */
  const redirectToAuth = (
    options: {
      isSignUp?: boolean;
      returnUrl?: string;
    } = {}
  ) => {
    const { isSignUp = false, returnUrl } = options;

    const currentUrl = returnUrl || window.location.href;
    const encodedReturnUrl = encodeURIComponent(currentUrl);
    const authPath = isSignUp ? REDIRECT_PATHS.SIGN_UP : REDIRECT_PATHS.SIGN_IN;

    debugLog.info("Redirecting to authentication", {
      service: "smart-redirect",
      isSignUp,
      currentUrl,
    });

    navigate({
      to: authPath,
      search: { redirect_url: encodedReturnUrl },
    });
  };

  /**
   * Redirect to checkout with proper parameters
   */
  const redirectToCheckout = (
    options: {
      tier?: string;
      billingCycle?: "monthly" | "annual";
    } = {}
  ) => {
    const { tier, billingCycle } = options;
    const searchParams: Record<string, string> = {};

    if (tier) searchParams.tier = tier;
    if (billingCycle) searchParams.billing = billingCycle;

    debugLog.info("Redirecting to checkout", {
      service: "smart-redirect",
      tier,
      billingCycle,
    });

    navigate({
      to: REDIRECT_PATHS.CHECKOUT,
      search: searchParams,
    });
  };

  return {
    smartRedirect,
    redirectToAuth,
    redirectToCheckout,
    userContext: getUserContext(
      isAuthenticated,
      hasBasicAccess && !!role,
      false
    ),
  };
}

/**
 * Utility function to determine if a route is public
 */
export function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    REDIRECT_PATHS.HOME,
    REDIRECT_PATHS.PRICING,
    REDIRECT_PATHS.SIGN_IN,
    REDIRECT_PATHS.SIGN_UP,
    "/contact",
    "/faq",
    "/features",
    "/support",
    "/terms",
    "/privacy",
  ];

  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  );
}

/**
 * Utility function to determine if a route is an auth route
 */
export function isAuthRoute(pathname: string): boolean {
  const authRoutes = [REDIRECT_PATHS.SIGN_IN, REDIRECT_PATHS.SIGN_UP];

  return authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Get appropriate redirect for unauthenticated users
 */
export function getUnauthenticatedRedirect(
  currentPath: string,
  isSignUpPreferred: boolean = false
): { path: string; search?: Record<string, string> } {
  const returnUrl = encodeURIComponent(window.location.href);
  const authPath = isSignUpPreferred
    ? REDIRECT_PATHS.SIGN_UP
    : REDIRECT_PATHS.SIGN_IN;

  return {
    path: authPath,
    search: { redirect_url: returnUrl },
  };
}
