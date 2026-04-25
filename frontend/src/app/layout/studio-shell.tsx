/**
 * StudioShell — Unified dark app shell layout.
 */

import type { ReactNode } from "react";
import { StudioFooter } from "./studio-footer";
import { StudioTopBar } from "./studio-top-bar";

export type ShellVariant = "studio" | "public" | "customer" | "admin" | "auth";

interface StudioShellProps {
  variant: ShellVariant;
  children: ReactNode;
  showFooter?: boolean;
  activeTab?: string;
  niche?: string;
  onNicheChange?: (n: string) => void;
  onScan?: () => void;
}

export function StudioShell({
  variant,
  children,
  showFooter = false,
  activeTab,
  niche,
  onNicheChange,
  onScan,
}: StudioShellProps) {
  return (
    <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
      <StudioTopBar
        variant={variant}
        activeTab={activeTab ?? ""}
        niche={niche ?? ""}
        onNicheChange={onNicheChange ?? (() => {})}
        onScan={onScan ?? (() => {})}
      />
      <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <main className="flex-1">{children}</main>
        {showFooter && <StudioFooter />}
      </div>
    </div>
  );
}
