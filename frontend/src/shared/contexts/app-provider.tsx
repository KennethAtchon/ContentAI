import { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { ProfileProvider } from "./profile-context";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>{children}</ProfileProvider>
    </AuthProvider>
  );
}
