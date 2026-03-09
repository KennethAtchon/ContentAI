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
      className={`relative overflow-hidden border-b border-white/[0.05] ${className || ""}`}
    >
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-studio-accent/[0.04] via-studio-purple/[0.02] to-transparent" />

      <div className="max-w-[900px] mx-auto relative py-14 md:py-20 px-6 text-center">
        {badge && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-studio backdrop-blur-sm">
            {BadgeIcon && (
              <BadgeIcon className="h-3.5 w-3.5 text-studio-accent" />
            )}
            <span className="text-slate-200/50">{badge.text}</span>
          </div>
        )}
        <h1 className="mb-5 text-[32px] md:text-[42px] font-bold text-slate-100 tracking-tight leading-[1.12]">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] text-slate-200/45 max-w-[600px] mx-auto leading-[1.65]">
            {description}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
