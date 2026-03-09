import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";

const TABS = [
  { key: "discover", path: "/studio/discover" },
  { key: "generate", path: "/studio/generate" },
  { key: "queue",    path: "/studio/queue"    },
] as const;

interface Props {
  niche: string;
  onNicheChange: (niche: string) => void;
  onScan: () => void;
  activeTab: string;
}

export function StudioTopBar({ niche, onNicheChange, onScan, activeTab }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="bg-studio-topbar border-b border-white/[0.06] flex items-center px-4 shrink-0 gap-0 font-studio">
      {/* Logo */}
      <Link
        to="/studio/discover"
        className="flex items-center gap-2 pr-5 border-r border-white/[0.06] mr-4 no-underline hover:opacity-90 transition-opacity"
      >
        <div className="w-6 h-6 bg-gradient-to-br from-studio-accent to-studio-purple rounded-[7px] flex items-center justify-center text-[11px] shrink-0">
          ✦
        </div>
        <span className="text-[14px] font-bold text-slate-100 tracking-[-0.3px]">
          ReelStudio
        </span>
      </Link>

      {/* Tabs */}
      <nav className="flex h-full">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigate({ to: tab.path })}
            className={cn(
              "h-full px-4 flex items-center gap-1.5 text-[13px] font-medium transition-all duration-150",
              "bg-transparent border-0 border-b-2 cursor-pointer font-studio",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-studio-ring",
              activeTab === tab.key
                ? "text-studio-accent border-b-studio-accent"
                : "text-slate-200/40 border-b-transparent hover:text-slate-200/70",
            )}
          >
            {tab.key === "generate" && (
              <span className="text-studio-accent">✦</span>
            )}
            {t(`studio_tabs_${tab.key}`)}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Search + Scan */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={niche}
          onChange={(e) => onNicheChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onScan()}
          placeholder={t("studio_search_placeholder")}
          className={cn(
            "w-44 bg-white/[0.05] border border-white/[0.08] rounded-lg",
            "text-studio-fg text-[12px] px-3 py-1.5 outline-none font-studio",
            "placeholder:text-slate-200/25 transition-colors duration-200",
            "focus:border-studio-ring/50",
          )}
        />
        <button
          onClick={onScan}
          className={cn(
            "bg-gradient-to-br from-studio-accent to-studio-purple",
            "text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border-0",
            "cursor-pointer transition-opacity duration-150 hover:opacity-85 font-studio",
          )}
        >
          {t("studio_search_scan")}
        </button>
      </div>
    </header>
  );
}
