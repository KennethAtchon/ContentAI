/**
 * PageLayout Component
 *
 * Standardized page layout wrapper that handles NavBar and Footer automatically.
 */

import { ReactNode } from "react";
import NavBar from "@/shared/components/layout/navbar";
import FooterCustom from "@/shared/components/layout/footer-custom";

export type PageLayoutVariant = "public" | "customer" | "admin";

export interface PageLayoutProps {
  /**
   * Layout variant determines which navigation to show
   */
  variant?: PageLayoutVariant;
  /**
   * Page content
   */
  children: ReactNode;
  /**
   * Custom className for the wrapper
   */
  className?: string;
  /**
   * Whether to show footer
   * @default true
   */
  showFooter?: boolean;
  /**
   * Whether to show navbar
   * @default true
   */
  showNavbar?: boolean;
}

export function PageLayout({
  variant: _variant = "public",
  children,
  className,
  showFooter = true,
  showNavbar = true,
}: PageLayoutProps) {
  return (
    <div
      className={`flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20 ${className || ""}`}
    >
      {showNavbar && <NavBar />}
      <main className="flex-1">{children}</main>
      {showFooter && <FooterCustom />}
    </div>
  );
}
