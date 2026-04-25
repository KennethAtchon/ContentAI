import { Circle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function ProviderStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border",
        active
          ? "bg-green-500/10 text-green-400 border-green-500/20"
          : "bg-overlay-sm text-dim-3 border-overlay-md"
      )}
    >
      <Circle
        className={cn(
          "h-1.5 w-1.5",
          active ? "fill-green-400 text-green-400" : "fill-current text-dim-3"
        )}
      />
      {active ? "Active" : "No API key"}
    </span>
  );
}
