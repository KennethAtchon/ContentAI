/**
 * Section Component
 *
 * Standardized section container with consistent spacing and max-width.
 */

import { ReactNode } from "react";
import { cn } from "@/shared/utils/helpers/utils";

export interface SectionProps {
  /**
   * Section content
   */
  children: ReactNode;
  /**
   * Maximum width of content
   * @default "4xl"
   */
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
  /**
   * Padding variant
   * @default "default"
   */
  padding?: "none" | "sm" | "default" | "lg";
  /**
   * Background variant
   */
  variant?: "default" | "muted" | "gradient";
  /**
   * Custom className
   */
  className?: string;
}

const maxWidthClasses = {
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

const paddingClasses = {
  none: "",
  sm: "py-8 md:py-12",
  default: "py-16 md:py-24",
  lg: "py-20 md:py-32",
};

const variantClasses = {
  default: "",
  muted: "bg-muted/30",
  gradient: "bg-gradient-to-b from-muted/50 to-background",
};

export function Section({
  children,
  maxWidth = "4xl",
  padding = "default",
  variant = "default",
  className,
}: SectionProps) {
  return (
    <section
      className={cn(
        "container",
        paddingClasses[padding],
        variantClasses[variant],
        className
      )}
    >
      <div className={cn("mx-auto", maxWidthClasses[maxWidth])}>{children}</div>
    </section>
  );
}
