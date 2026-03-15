import { useTranslation } from "react-i18next";
import { Music } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import type { MusicTrack } from "../types/audio.types";

interface MusicAttachmentProps {
  hasVoiceover: boolean;
  currentTrack: MusicTrack | null;
  onBrowse: () => void;
  onRemove: () => void;
}

export function MusicAttachment({
  hasVoiceover,
  currentTrack,
  onBrowse,
  onRemove,
}: MusicAttachmentProps) {
  const { t } = useTranslation();

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Music className="w-6 h-6 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          {t("audio_music_addPrompt")}
        </p>
        <button
          onClick={onBrowse}
          disabled={!hasVoiceover}
          title={
            !hasVoiceover
              ? t("audio_music_browseDisabledTooltip")
              : undefined
          }
          className="text-xs font-medium px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("audio_music_browse")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{currentTrack.name}</p>
          {currentTrack.artistName && (
            <p className="text-[10px] text-muted-foreground truncate">
              {currentTrack.artistName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onBrowse}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("audio_music_change")}
          </button>
          <span className="text-muted-foreground/30">·</span>
          <button
            onClick={onRemove}
            className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
          >
            {t("audio_music_remove")}
          </button>
        </div>
      </div>
      <AudioPlayer
        src={currentTrack.previewUrl}
        duration={currentTrack.durationSeconds}
        variant="compact"
      />
    </div>
  );
}
