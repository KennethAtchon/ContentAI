import { ReactNode } from "react";

const CUSTOMER_LAYOUT_CLASSES = "min-h-screen bg-background";

interface CustomerLayoutProps {
  readonly children: ReactNode;
}

/**
 * Layout component for customer-facing pages
 * Main routes (account, checkout, payment) are handled by main-layout.tsx
 * Auth routes (sign-in, sign-up) are handled by auth-layout.tsx
 */
export function CustomerLayout({ children }: CustomerLayoutProps) {
  return <div className={CUSTOMER_LAYOUT_CLASSES}>{children}</div>;
}
