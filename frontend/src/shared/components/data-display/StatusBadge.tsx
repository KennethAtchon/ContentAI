import { cn } from "@/shared/utils/helpers/utils";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-white/10 text-white/70",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-200",
  danger: "bg-rose-500/15 text-rose-200",
  info: "bg-sky-500/15 text-sky-200",
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
