import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import type { MusicTrack } from "../types/audio.types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface MusicTrackRowProps {
  track: MusicTrack;
  isSelected?: boolean;
  onSelect: () => void;
}

export function MusicTrackRow({
  track,
  isSelected,
  onSelect,
}: MusicTrackRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <AudioPlayer
        src={track.previewUrl}
        variant="compact"
        duration={track.durationSeconds}
        className="shrink-0"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{track.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {track.artistName && (
            <span className="text-[11px] text-muted-foreground truncate">
              {track.artistName}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {formatDuration(track.durationSeconds)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
            {track.mood}
          </span>
        </div>
      </div>

      {isSelected ? (
        <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-primary" />
        </div>
      ) : (
        <button
          onClick={onSelect}
          className="shrink-0 text-xs font-medium px-2.5 py-1 rounded border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
        >
          {t("audio_music_select")}
        </button>
      )}
    </div>
  );
}
