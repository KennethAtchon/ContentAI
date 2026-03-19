import { useTranslation } from "react-i18next";
import { fmtNum } from "../hooks/use-reels";
import type { ReelDetail } from "../types/reel.types";

interface Props {
  reel: ReelDetail;
}

export function PhonePreview({ reel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
      {/* Floating stat cards */}
      <StatCard
        label={t("studio_panel_engagementRate")}
        value={`${reel.engagementRate ?? "0"}%`}
        className="absolute top-8 left-10"
      />
      <StatCard
        label={t("studio_panel_totalViews")}
        value={fmtNum(reel.views)}
        className="absolute top-8 right-10"
      />
      <StatCard
        label={t("studio_panel_posted")}
        value={reel.daysAgo != null ? `${reel.daysAgo}d ago` : "—"}
        valueClassName="text-base"
        className="absolute bottom-20 left-10"
      />
      <StatCard
        label={t("studio_panel_likes")}
        value={fmtNum(reel.likes)}
        valueClassName="text-studio-purple"
        className="absolute bottom-20 right-10"
      />

      {/* Phone mockup */}
      <div className="w-[220px] h-[390px] rounded-[32px] border-2 border-overlay-lg bg-surface-1 relative overflow-hidden studio-phone-shadow shrink-0">
        {/* Notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[60px] h-1.5 bg-[#222] rounded-full z-[2]" />

        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] to-[#16213E]" />

        {/* Center emoji */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-7xl z-[1]">
          {reel.thumbnailEmoji ?? "🎬"}
        </div>

        {/* Side actions */}
        <div className="absolute right-2.5 bottom-[60px] flex flex-col gap-3 items-center z-[2]">
          <PhoneAction icon="❤️" label={fmtNum(reel.likes)} />
          <PhoneAction icon="💬" label={fmtNum(reel.comments)} />
          <PhoneAction icon="↗" />
        </div>

        {/* Bottom overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end p-5 bg-gradient-to-b from-transparent via-transparent to-black/[0.85] z-[1]">
          <p className="self-start text-sm font-bold text-white mb-1">
            {reel.username}
          </p>
          {reel.hook && (
            <p className="self-start text-sm text-white/85 leading-[1.4] mb-2.5">
              {reel.hook.slice(0, 60)}…
            </p>
          )}
          {reel.audioName && (
            <div className="self-start flex items-center gap-1 text-sm text-white/60">
              <span className="text-white font-bold">♪</span>
              {reel.audioName.slice(0, 20)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={`bg-studio-topbar/90 border border-overlay-md rounded-xl px-3.5 py-2.5 backdrop-blur-xl text-sm ${className ?? ""}`}
    >
      <p className="text-dim-3 text-sm mb-0.5">{label}</p>
      <p
        className={`text-lg font-bold text-studio-accent ${valueClassName ?? ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function PhoneAction({ icon, label }: { icon: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-[34px] h-[34px] rounded-full bg-white/15 flex items-center justify-center text-lg backdrop-blur-sm">
        {icon}
      </div>
      {label && <span className="text-sm text-white">{label}</span>}
    </div>
  );
}
