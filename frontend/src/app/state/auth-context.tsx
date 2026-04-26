import { useAuthStore } from "@/app/store/auth-store";
import { useShallow } from "zustand/react/shallow";

export interface AuthContextValue {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  authLoading: boolean;
  backendReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthContextValue {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      authLoading: state.authLoading,
      backendReady: state.backendReady,
      signIn: state.signIn,
      signUp: state.signUp,
      signInWithGoogle: state.signInWithGoogle,
      logout: state.logout,
    }))
  );
}

export function useCurrentUser() {
  return useAuthStore((state) => state.user);
}

export function useIsAuthenticated() {
  return useAuthStore((state) => Boolean(state.user));
}

export function useAuthActions() {
  return useAuthStore(
    useShallow((state) => ({
      signIn: state.signIn,
      signUp: state.signUp,
      signInWithGoogle: state.signInWithGoogle,
      logout: state.logout,
    }))
  );
}
