/**
 * App Context - Application-wide state management
 *
 * Provides unified access to authentication and user-related data throughout the app.
 * Consolidates Firebase auth with user profile data from the API.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/shared/services/firebase/config";
import { authenticatedFetchJson as baseAuthenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { safeFetch } from "@/shared/services/api/safe-fetch";
import { API_URL } from "@/shared/utils/config/envUtil";
import { addTimezoneHeader } from "@/shared/utils/api/add-timezone-header";
import { debugLog } from "@/shared/utils/debug";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { QUERY_STALE } from "@/shared/lib/query-client";

function clearApiQueryCache(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return Array.isArray(key) && key[0] === "api";
    },
  });
}

/**
 * User profile data from the API
 */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * App context type definition
 */
interface AppContextType {
  // Authentication state (from Firebase)
  /** Current authenticated Firebase user or null */
  user: User | null;
  /** Whether authentication state is being determined */
  authLoading: boolean;
  /** Whether user profile is being fetched */
  profileLoading: boolean;
  /** User profile data from API or null */
  profile: UserProfile | null;
  /** Error message if profile fetch fails */
  profileError: string | null;
  /** Whether the user authenticated via OAuth (Google, etc.) */
  isOAuthUser: boolean;

  // Authentication methods (from Firebase)
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign up with email, password, and optional display name */
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  /** Sign in with Google OAuth popup */
  signInWithGoogle: () => Promise<void>;
  /** Sign out current user */
  logout: () => Promise<void>;

  // User profile methods
  /** Refresh user profile data from API */
  refreshProfile: () => Promise<void>;
  /** Update user profile data */
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  /** Check if user is authenticated */
  isAuthenticated: boolean;
  /** Check if user is admin */
  isAdmin: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Default context value for when AppProvider is not available (e.g., during static generation).
 * Provides safe no-op methods and default state values.
 */
const defaultContext: AppContextType = {
  // Auth state - all null/false during static generation
  user: null,
  authLoading: false,
  profileLoading: false,
  profile: null,
  profileError: null,
  isOAuthUser: false,

  // Auth methods - no-ops that throw helpful errors if called
  signIn: async () => {
    throw new Error("Cannot sign in: AppProvider not available");
  },
  signUp: async () => {
    throw new Error("Cannot sign up: AppProvider not available");
  },
  signInWithGoogle: async () => {
    throw new Error("Cannot sign in with Google: AppProvider not available");
  },
  logout: async () => {
    throw new Error("Cannot logout: AppProvider not available");
  },

  // Profile methods - no-ops that throw helpful errors if called
  refreshProfile: async () => {
    throw new Error("Cannot refresh profile: AppProvider not available");
  },
  updateProfile: async () => {
    throw new Error("Cannot update profile: AppProvider not available");
  },

  // Computed values - all false during static generation
  isAuthenticated: false,
  isAdmin: false,
};

/**
 * Hook to access app context.
 * Returns default context if AppProvider is not available (e.g., during static generation).
 * This allows components to work during static generation without throwing errors.
 *
 * @returns App context with auth and user profile state, or default context if unavailable
 */
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  // Return default context if AppProvider is not available (e.g., during static generation)
  // This allows components to render safely during SSG without throwing errors
  return context ?? defaultContext;
}

/**
 * Props for the AppProvider component.
 */
interface AppProviderProps {
  /** Child components that will have access to app context */
  children: ReactNode;
}

/**
 * App provider component.
 * Provides Firebase authentication and user profile data from API.
 */
export function AppProvider({ children }: AppProviderProps) {
  // Firebase auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const queryClient = useQueryClient();

  // User profile state - now using React Query
  const fetcher = useQueryFetcher<{
    profile: UserProfile;
    isOAuthUser: boolean;
  }>();

  // Initialize Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      debugLog.info(
        "Authentication state changed",
        { service: "app-context", operation: "onAuthStateChanged" },
        {
          userId: firebaseUser?.uid || "anonymous",
          isAuthenticated: !!firebaseUser,
        }
      );

      if (!firebaseUser) {
        clearApiQueryCache(queryClient);
        setUser(null);
        setBackendReady(false);
        setAuthLoading(false);
        return;
      }

      setUser(firebaseUser);
      setAuthLoading(false);

      // Ensure user exists in DB before the profile query can fire.
      // Uses safeFetch directly — /api/auth/register does not validate CSRF.
      try {
        const token = await firebaseUser.getIdToken();
        await safeFetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        debugLog.error(
          "Failed to sync user with backend",
          { service: "app-context", operation: "onAuthStateChanged" },
          error
        );
      }
      setBackendReady(true);
    });
    return unsubscribe;
  }, [queryClient]);

  // Firebase auth methods
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      debugLog.info(
        "User signed in successfully",
        { service: "app-context", operation: "signIn" },
        { email }
      );
    } catch (error) {
      debugLog.error(
        "Sign in failed",
        { service: "app-context", operation: "signIn" },
        error
      );
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (name && userCredential.user) {
          await updateFirebaseProfile(userCredential.user, {
            displayName: name,
          });
        }
        debugLog.info(
          "User signed up successfully",
          { service: "app-context", operation: "signUp" },
          { email, hasDisplayName: !!name }
        );
      } catch (error) {
        debugLog.error(
          "Sign up failed",
          { service: "app-context", operation: "signUp" },
          error
        );
        throw error;
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      debugLog.info("Google sign in successful", {
        service: "app-context",
        operation: "signInWithGoogle",
      });
    } catch (error) {
      debugLog.error(
        "Google sign in failed",
        { service: "app-context", operation: "signInWithGoogle" },
        error
      );
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Clear all user-specific query caches before signing out to prevent data leakage
      clearApiQueryCache(queryClient);

      await signOut(auth);
      debugLog.info("User logged out successfully", {
        service: "app-context",
        operation: "logout",
      });
    } catch (error) {
      debugLog.error(
        "Logout failed",
        { service: "app-context", operation: "logout" },
        error
      );
      throw error;
    }
  }, [queryClient]);

  // Helper function to fetch JSON with timezone header
  // Uses base service directly to avoid circular dependency with useAuthenticatedFetch hook
  const authenticatedFetchJson = useCallback(
    async <T,>(
      url: string,
      options: RequestInit = {}
    ): Promise<T> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      return baseAuthenticatedFetchJson<T>(url, addTimezoneHeader(options));
    },
    [user]
  );

  // Use React Query for profile fetching with 5-minute cache
  const {
    data: profileResponse,
    error: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.api.profile(),
    queryFn: () => fetcher("/api/customer/profile"),
    enabled: !!user && !authLoading && backendReady,
    staleTime: QUERY_STALE.long,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    gcTime: QUERY_STALE.long,
  });

  // Extract profile from SWR response
  const profile = useMemo(
    () => profileResponse?.profile || null,
    [profileResponse]
  );

  // Extract isOAuthUser from SWR response
  const isOAuthUser = useMemo(
    () => profileResponse?.isOAuthUser || false,
    [profileResponse]
  );

  // Extract profile error
  const profileErrorState = useMemo(
    () =>
      profileError
        ? profileError instanceof Error
          ? profileError.message
          : "Failed to fetch user profile"
        : null,
    [profileError]
  );

  /**
   * Refreshes user profile data
   */
  const refreshProfile = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  /**
   * Updates user profile data
   */
  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user || !profile) {
        throw new Error("User must be authenticated to update profile");
      }

      try {
        const response = await authenticatedFetchJson<{
          message: string;
          profile: UserProfile;
        }>("/api/customer/profile", {
          method: "PUT",
          body: JSON.stringify(updates),
        });

        // Response is auto-unwrapped by authenticatedFetchJson
        if (!response.profile) {
          throw new Error("Profile data not found in response");
        }

        // Update React Query cache with new profile data, preserving isOAuthUser
        const currentIsOAuthUser = profileResponse?.isOAuthUser || false;
        queryClient.setQueryData(queryKeys.api.profile(), {
          profile: response.profile,
          isOAuthUser: currentIsOAuthUser,
        });

        debugLog.info("User profile updated successfully", {
          service: "app-context",
          operation: "updateProfile",
          userId: profile.id,
        });
      } catch (error) {
        debugLog.error(
          "Failed to update user profile",
          {
            service: "app-context",
            operation: "updateProfile",
            userId: profile.id,
          },
          error
        );
        throw error;
      }
    },
    [user, profile, authenticatedFetchJson, profileResponse, queryClient]
  );

  // Computed values
  const isAuthenticated = useMemo(() => !!user && !!profile, [user, profile]);
  const isAdmin = useMemo(
    () => profile?.role === "admin" || false,
    [profile?.role]
  );

  const value: AppContextType = useMemo(
    () => ({
      // Auth state
      user,
      authLoading,
      profileLoading,
      profile,
      profileError: profileErrorState,
      isOAuthUser,

      // Auth methods
      signIn,
      signUp,
      signInWithGoogle,
      logout,

      // Profile methods
      refreshProfile,
      updateProfile,

      // Computed
      isAuthenticated,
      isAdmin,
    }),
    [
      user,
      authLoading,
      profileLoading,
      profile,
      profileErrorState,
      isOAuthUser,
      signIn,
      signUp,
      signInWithGoogle,
      logout,
      refreshProfile,
      updateProfile,
      isAuthenticated,
      isAdmin,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
