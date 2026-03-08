/**
 * HeroSection Component
 *
 * Standardized hero section for pages.
 */

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export interface HeroSectionProps {
  /**
   * Badge text and icon (optional)
   */
  badge?: {
    icon?: LucideIcon;
    text: string;
  };
  /**
   * Main title
   */
  title: string | ReactNode;
  /**
   * Description text
   */
  description?: string | ReactNode;
  /**
   * Custom content to render in hero
   */
  children?: ReactNode;
  /**
   * Whether to show gradient background
   * @default true
   */
  showGradient?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

export function HeroSection({
  badge,
  title,
  description,
  children,
  showGradient = true,
  className,
}: HeroSectionProps) {
  const BadgeIcon = badge?.icon;

  return (
    <section className={`relative overflow-hidden border-b ${className || ""}`}>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
      )}
      <div className="container relative py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          {badge && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm backdrop-blur-sm">
              {BadgeIcon && <BadgeIcon className="h-4 w-4 text-primary" />}
              <span className="text-muted-foreground">{badge.text}</span>
            </div>
          )}
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="text-xl text-muted-foreground md:text-2xl max-w-2xl mx-auto">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
