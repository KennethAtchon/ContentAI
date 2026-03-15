import { useTranslation } from "react-i18next";
import { fmtNum } from "../hooks/use-reels";
import { cn } from "@/shared/utils/helpers/utils";
import type { Reel } from "../types/reel.types";

interface Props {
  reels: Reel[];
  activeId: number | null;
  onSelect: (id: number) => void;
}

export function ReelList({ reels, activeId, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <>
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[1.5px] uppercase text-slate-200/25">
          {t("studio_sidebar_sourceReels")}
        </span>
        <span className="bg-studio-accent/15 text-studio-accent text-[9px] font-bold px-1.5 py-px rounded-full">
          {reels.length}
        </span>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {reels.map((reel) => {
          const isActive = activeId === reel.id;
          return (
            <button
              key={reel.id}
              onClick={() => onSelect(reel.id)}
              className={cn(
                "w-full px-3 py-2 flex items-center gap-2.5 text-left",
                "border-0 border-l-2 transition-colors duration-100 font-studio cursor-pointer",
                isActive
                  ? "bg-studio-accent/[0.08] border-l-studio-accent"
                  : "bg-transparent border-l-transparent hover:bg-white/[0.03]"
              )}
            >
              {/* Thumbnail image or emoji fallback */}
              {reel.thumbnailR2Url ? (
                <img
                  src={reel.thumbnailR2Url}
                  alt={reel.username}
                  className={cn(
                    "w-[38px] h-[50px] rounded-[6px] object-cover shrink-0",
                    isActive && "ring-1 ring-studio-accent/50"
                  )}
                  loading="lazy"
                />
              ) : (
                <div
                  className={cn(
                    "w-[38px] h-[50px] rounded-[6px] flex items-center justify-center text-base shrink-0",
                    isActive ? "bg-studio-accent/15" : "bg-white/[0.06]"
                  )}
                >
                  {reel.thumbnailEmoji ?? "🎬"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-studio-fg truncate">
                  {reel.username}
                </p>
                <p className="text-[10px] text-slate-200/35 mt-px">
                  {fmtNum(reel.views)} · {reel.engagementRate ?? "0"}%
                </p>
                {reel.videoR2Url ? (
                  <span className="inline-block mt-0.5 text-[8px] font-semibold text-green-400/70 bg-green-400/10 px-1 py-px rounded">
                    ▶ VIDEO
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}

        {reels.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-3.5 py-8 text-center">
            <p className="text-[11px] font-semibold text-slate-200/40">
              {t("studio_sidebar_noReels")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
