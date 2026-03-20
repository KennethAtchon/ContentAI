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
        "bg-overlay-xs border border-overlay-sm rounded-[14px] p-5",
        hoverable &&
          "transition-all hover:border-studio-accent/30 group cursor-pointer",
        className
      )}
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-studio-accent/15 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5 text-studio-accent" />
      </div>
      <h3 className="mb-1.5 text-base font-bold text-studio-fg">{title}</h3>
      {description && (
        <p className="text-sm text-dim-2 leading-[1.6]">{description}</p>
      )}
      {children}
    </div>
  );
}
