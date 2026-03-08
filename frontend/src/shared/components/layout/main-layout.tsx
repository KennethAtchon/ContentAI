import { ReactNode } from "react";
import { AuthGuard } from "@/features/auth/components/auth-guard";

const MAIN_LAYOUT_CLASSES = "min-h-screen bg-background";

interface MainLayoutProps {
  readonly children: ReactNode;
}

/**
 * Layout component for main customer pages (account, checkout, payment)
 * Protected by AuthGuard which requires user authentication
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <AuthGuard authType="user">
      <div className={MAIN_LAYOUT_CLASSES}>
        <main>{children}</main>
      </div>
    </AuthGuard>
  );
}
