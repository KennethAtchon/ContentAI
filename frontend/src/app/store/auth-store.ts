import { create } from "zustand";
import {
  GoogleAuthProvider,
  type User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import { auth } from "@/shared/platform/firebase-services/config";
import { safeFetch } from "@/shared/api/safe-fetch";
import { API_URL } from "@/shared/config/envUtil";
import { debugLog } from "@/shared/debug";
import { appQueryClient } from "@/app-query-client";

type AuthState = {
  user: User | null;
  authLoading: boolean;
  backendReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

function clearApiQueryCache() {
  appQueryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return Array.isArray(key) && key[0] === "api";
    },
  });
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  authLoading: true,
  backendReady: false,
  signIn: async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      debugLog.info("User signed in successfully", {
        service: "auth-store",
        operation: "signIn",
      });
    } catch (error) {
      debugLog.error(
        "Sign in failed",
        { service: "auth-store", operation: "signIn" },
        error
      );
      throw error;
    }
  },
  signUp: async (email, password, name) => {
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
        service: "auth-store",
        operation: "signUp",
      });
    } catch (error) {
      debugLog.error(
        "Sign up failed",
        { service: "auth-store", operation: "signUp" },
        error
      );
      throw error;
    }
  },
  signInWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      debugLog.info("Google sign in successful", {
        service: "auth-store",
        operation: "signInWithGoogle",
      });
    } catch (error) {
      debugLog.error(
        "Google sign in failed",
        { service: "auth-store", operation: "signInWithGoogle" },
        error
      );
      throw error;
    }
  },
  logout: async () => {
    try {
      clearApiQueryCache();
      await signOut(auth);
      debugLog.info("User logged out successfully", {
        service: "auth-store",
        operation: "logout",
      });
    } catch (error) {
      debugLog.error(
        "Logout failed",
        { service: "auth-store", operation: "logout" },
        error
      );
      throw error;
    }
  },
}));

let authStoreInitialized = false;

export function initializeAuthStore() {
  if (authStoreInitialized) return;
  authStoreInitialized = true;

  onAuthStateChanged(auth, async (firebaseUser) => {
    debugLog.info(
      "Authentication state changed",
      { service: "auth-store", operation: "onAuthStateChanged" },
      {
        userId: firebaseUser?.uid || "anonymous",
        isAuthenticated: !!firebaseUser,
      }
    );

    if (!firebaseUser) {
      clearApiQueryCache();
      useAuthStore.setState({
        user: null,
        backendReady: false,
        authLoading: false,
      });
      return;
    }

    useAuthStore.setState({
      user: firebaseUser,
      authLoading: false,
      backendReady: false,
    });

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
        { service: "auth-store", operation: "onAuthStateChanged" },
        error
      );
    }

    useAuthStore.setState({ backendReady: true });
  });
}
