/**
 * StudioHero — Dark-themed hero section for marketing/public pages.
 */

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export interface StudioHeroProps {
  badge?: { icon?: LucideIcon; text: string };
  title: string | ReactNode;
  description?: string | ReactNode;
  children?: ReactNode;
  className?: string;
  showGradient?: boolean;
}

export function StudioHero({
  badge,
  title,
  description,
  children,
  className,
}: StudioHeroProps) {
  const BadgeIcon = badge?.icon;

  return (
    <section
      className={`relative overflow-hidden border-b border-overlay-sm ${className || ""}`}
    >
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-studio-accent/[0.04] via-studio-purple/[0.02] to-transparent" />

      <div className="max-w-[900px] mx-auto relative py-14 md:py-20 px-6 text-center">
        {badge && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-overlay-md bg-overlay-xs px-3.5 py-1.5 text-sm font-studio backdrop-blur-sm">
            {BadgeIcon && (
              <BadgeIcon className="h-3.5 w-3.5 text-studio-accent" />
            )}
            <span className="text-dim-2">{badge.text}</span>
          </div>
        )}
        <h1 className="mb-5 text-4xl md:text-5xl font-bold text-primary tracking-tight leading-[1.12]">
          {title}
        </h1>
        {description && (
          <p className="text-base text-dim-2 max-w-[600px] mx-auto leading-[1.65]">
            {description}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
