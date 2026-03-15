import { useTranslation } from "react-i18next";
import type { Voice } from "../types/audio.types";
import { AudioPlayer } from "./AudioPlayer";

const AVATAR_COLORS: Record<string, string> = {
  "aria-v1": "from-pink-400 to-purple-400",
  "marcus-v1": "from-blue-400 to-indigo-400",
  "luna-v1": "from-yellow-400 to-orange-400",
  "james-v1": "from-green-400 to-teal-400",
  "nova-v1": "from-violet-400 to-pink-400",
};

interface VoiceCardProps {
  voice: Voice;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function VoiceCard({
  voice,
  isSelected,
  onSelect,
  disabled,
}: VoiceCardProps) {
  const { t: _t } = useTranslation();
  const initials = voice.name.slice(0, 2).toUpperCase();
  const gradient = AVATAR_COLORS[voice.id] || "from-muted to-muted-foreground";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative w-[120px] shrink-0 h-[140px] rounded-xl border-2 flex flex-col items-center p-3 gap-1.5 transition-all cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div
        className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm shrink-0`}
      >
        {initials}
      </div>
      <span className="text-[13px] font-semibold leading-tight text-center">
        {voice.name}
      </span>
      <span className="text-[11px] text-muted-foreground leading-tight text-center line-clamp-2">
        {voice.description}
      </span>

      {voice.previewUrl && (
        <div
          className="absolute bottom-2 right-2"
          onClick={(e) => e.stopPropagation()}
        >
          <AudioPlayer src={voice.previewUrl} variant="compact" duration={3} />
        </div>
      )}
    </div>
  );
}
