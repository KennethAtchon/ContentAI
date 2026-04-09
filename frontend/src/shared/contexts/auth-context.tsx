import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
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
import { safeFetch } from "@/shared/services/api/safe-fetch";
import { API_URL } from "@/shared/utils/config/envUtil";
import { debugLog } from "@/shared/utils/debug";
import { useQueryClient } from "@tanstack/react-query";

function clearApiQueryCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return Array.isArray(key) && key[0] === "api";
    },
  });
}

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  /** Set to true after the backend /api/auth/register call succeeds for the current user. Profile queries gate on this. */
  backendReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      debugLog.info(
        "Authentication state changed",
        { service: "auth-context", operation: "onAuthStateChanged" },
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
          { service: "auth-context", operation: "onAuthStateChanged" },
          error
        );
      }
      setBackendReady(true);
    });
    return unsubscribe;
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      debugLog.info("User signed in successfully", {
        service: "auth-context",
        operation: "signIn",
      });
    } catch (error) {
      debugLog.error(
        "Sign in failed",
        { service: "auth-context", operation: "signIn" },
        error
      );
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (name && credential.user) {
          await updateFirebaseProfile(credential.user, { displayName: name });
        }
        debugLog.info("User signed up successfully", {
          service: "auth-context",
          operation: "signUp",
        });
      } catch (error) {
        debugLog.error(
          "Sign up failed",
          { service: "auth-context", operation: "signUp" },
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
        service: "auth-context",
        operation: "signInWithGoogle",
      });
    } catch (error) {
      debugLog.error(
        "Google sign in failed",
        { service: "auth-context", operation: "signInWithGoogle" },
        error
      );
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      clearApiQueryCache(queryClient);
      await signOut(auth);
      debugLog.info("User logged out successfully", {
        service: "auth-context",
        operation: "logout",
      });
    } catch (error) {
      debugLog.error(
        "Logout failed",
        { service: "auth-context", operation: "logout" },
        error
      );
      throw error;
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        backendReady,
        signIn,
        signUp,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
