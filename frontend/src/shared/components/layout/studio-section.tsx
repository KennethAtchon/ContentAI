/**
 * StudioSection — Dark-themed section container for content pages.
 */

import { ReactNode } from "react";
import { cn } from "@/shared/utils/helpers/utils";

export interface StudioSectionProps {
  children: ReactNode;
  maxWidth?:
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "6xl"
    | "7xl"
    | "full";
  padding?: "none" | "sm" | "default" | "lg";
  variant?: "default" | "muted" | "gradient";
  className?: string;
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "py-6 md:py-10",
  default: "py-10 md:py-16",
  lg: "py-14 md:py-20",
};

const variantClasses: Record<string, string> = {
  default: "",
  muted: "bg-overlay-xs",
  gradient: "bg-gradient-to-b from-white/[0.02] to-transparent",
};

export function StudioSection({
  children,
  maxWidth = "4xl",
  padding = "default",
  variant = "default",
  className,
}: StudioSectionProps) {
  return (
    <section
      className={cn(
        "px-6",
        paddingClasses[padding],
        variantClasses[variant],
        className
      )}
    >
      <div className={cn("mx-auto", maxWidthClasses[maxWidth])}>{children}</div>
    </section>
  );
}
