/**
 * StudioShell — Unified dark app shell layout
 *
 * Replaces PageLayout for all routes. Provides the full-screen dark background,
 * StudioTopBar, and optional footer in a single consistent wrapper.
 */

import { ReactNode } from "react";
import { StudioTopBar } from "@/shared/ui/navigation/StudioTopBar";
import { StudioFooter } from "./studio-footer";

export type ShellVariant = "studio" | "public" | "customer" | "admin" | "auth";

interface StudioShellProps {
  /** Layout variant determines topbar navigation mode */
  variant: ShellVariant;
  /** Page content */
  children: ReactNode;
  /** Whether to show footer (only on public marketing pages) */
  showFooter?: boolean;
  /** Active tab for the topbar navigation highlight */
  activeTab?: string;
  /** Studio-specific: niche search value */
  niche?: string;
  /** Studio-specific: niche change handler */
  onNicheChange?: (n: string) => void;
  /** Studio-specific: scan action handler */
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
