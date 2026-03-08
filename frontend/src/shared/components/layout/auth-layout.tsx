import { ReactNode, Suspense } from "react";

const AUTH_BACKGROUND_CLASS = "min-h-screen bg-gray-50";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

/**
 * Layout component for authentication pages (sign-in, sign-up)
 * Provides a full-screen gray background for auth forms
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={AUTH_BACKGROUND_CLASS}>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
