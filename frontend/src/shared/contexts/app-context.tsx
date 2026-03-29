/**
 * App Context — backward-compatibility shim.
 *
 * Auth and profile state now live in separate contexts:
 *   - useAuth()    → auth-context.tsx  (user, authLoading, signIn, …)
 *   - useProfile() → profile-context.tsx (profile, isAdmin, updateProfile, …)
 *
 * All existing consumers of useApp() continue to work unchanged.
 * New code should prefer useAuth() or useProfile() directly.
 */

import { useMemo } from "react";
import { useAuth } from "./auth-context";
import { useProfile } from "./profile-context";

// Re-export AppProvider so main.tsx import is unchanged.
export { AppProvider } from "./app-provider";

// Re-export the split hooks for new code.
export { useAuth } from "./auth-context";
export { useProfile } from "./profile-context";

// Re-export UserProfile type so existing consumers don't need import path changes.
export type { UserProfile } from "./types";

/**
 * Combined hook — returns the full surface of both auth and profile contexts.
 * Existing consumers continue to call useApp() without any migration needed.
 */
export function useApp() {
  const auth = useAuth();
  const profile = useProfile();

  return useMemo(
    () => ({
      // Auth state
      user: auth.user,
      authLoading: auth.authLoading,
      // Profile state
      profileLoading: profile.profileLoading,
      profile: profile.profile,
      profileError: profile.profileError,
      isOAuthUser: profile.isOAuthUser,
      // Auth methods
      signIn: auth.signIn,
      signUp: auth.signUp,
      signInWithGoogle: auth.signInWithGoogle,
      logout: auth.logout,
      // Profile methods
      refreshProfile: profile.refreshProfile,
      updateProfile: profile.updateProfile,
      // Computed
      isAuthenticated: !!auth.user && !!profile.profile,
      isAdmin: profile.isAdmin,
    }),
    [auth, profile]
  );
}
