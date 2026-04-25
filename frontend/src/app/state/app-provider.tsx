import { ReactNode } from "react";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { AuthProvider } from "./auth-context";
import { ProfileProvider } from "./profile-context";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider storageKey="ui-theme">
      <AuthProvider>
        <ProfileProvider>{children}</ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
