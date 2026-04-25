import { cn } from "@/shared/lib/utils";

// ─── Tier display helpers ────────────────────────────────────────────────────

export function getTierDisplay(role: string | null | undefined) {
  switch (role) {
    case "basic":
      return {
        label: "Creator",
        badgeClass:
          "text-[hsl(234_89%_80%)] bg-[hsl(234_89%_74%/0.1)] border border-[hsl(234_89%_74%/0.2)]",
        dotClass: "bg-[hsl(234_89%_74%)]",
      };
    case "pro":
      return {
        label: "Pro",
        badgeClass:
          "text-[hsl(270_91%_82%)] bg-[hsl(270_91%_75%/0.1)] border border-[hsl(270_91%_75%/0.2)]",
        dotClass: "bg-[hsl(270_91%_75%)]",
      };
    case "agency":
      return {
        label: "Agency",
        badgeClass: "text-amber-300 bg-amber-500/10 border border-amber-500/20",
        dotClass: "bg-amber-400",
      };
    default:
      return {
        label: "Free",
        badgeClass: "text-dim-2 bg-overlay-xs border border-border",
        dotClass: "bg-foreground/25",
      };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** -1 and null both mean unlimited */
export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === null || limit === -1;
}

// ─── Usage bar ───────────────────────────────────────────────────────────────

export function UsageBar({
  value,
  max,
}: {
  value: number;
  max: number | null;
}) {
  const effectiveMax = isUnlimited(max) ? null : max;
  const pct = effectiveMax
    ? Math.min(100, Math.round((value / effectiveMax) * 100))
    : 0;
  const isHigh = pct >= 80;
  return (
    <div className="h-[3px] w-full rounded-full bg-overlay-sm overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          isHigh ? "bg-red-400/70" : "bg-[hsl(234_89%_74%/0.6)]"
        )}
        style={{ width: effectiveMax ? `${pct}%` : "0%" }}
      />
    </div>
  );
}
