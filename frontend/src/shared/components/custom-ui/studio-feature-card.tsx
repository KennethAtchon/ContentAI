/**
 * StudioFeatureCard — Dark-themed feature card with icon, title, and description.
 */

import { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";

export interface StudioFeatureCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  hoverable?: boolean;
  className?: string;
}

export function StudioFeatureCard({
  icon: Icon,
  title,
  description,
  children,
  hoverable = false,
  className,
}: StudioFeatureCardProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-5",
        hoverable &&
          "transition-all hover:border-studio-accent/30 group cursor-pointer",
        className
      )}
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-studio-accent/15 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5 text-studio-accent" />
      </div>
      <h3 className="mb-1.5 text-[14px] font-bold text-studio-fg">{title}</h3>
      {description && (
        <p className="text-[12px] text-slate-200/45 leading-[1.6]">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
