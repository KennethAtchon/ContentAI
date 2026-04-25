import { useTranslation } from "react-i18next";
import { AudioPlayer } from "./AudioPlayer";
import type { MusicTrack } from "../model/audio.types";

interface MusicAttachmentProps {
  currentTrack: MusicTrack | null;
  onBrowse: () => void;
  onRemove: () => void;
}

export function MusicAttachment({
  currentTrack,
  onBrowse,
  onRemove,
}: MusicAttachmentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("audio_music_sectionTitle")}
        </span>
        {currentTrack && (
          <div className="flex items-center gap-1">
            <button
              onClick={onBrowse}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("audio_music_change")}
            </button>
            <span className="text-muted-foreground/30">·</span>
            <button
              onClick={onRemove}
              className="text-sm text-destructive/70 hover:text-destructive transition-colors"
            >
              {t("audio_music_remove")}
            </button>
          </div>
        )}
      </div>

      {currentTrack ? (
        /* Track row: play button + name/artist */
        <div className="flex items-center gap-3">
          <AudioPlayer
            src={currentTrack.previewUrl}
            duration={currentTrack.durationSeconds}
            variant="compact"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentTrack.name}</p>
            {currentTrack.artistName && (
              <p className="text-sm text-muted-foreground truncate">
                {currentTrack.artistName}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("audio_music_addPrompt")}
          </p>
          <button
            onClick={onBrowse}
            className="text-sm font-medium px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors shrink-0"
          >
            {t("audio_music_browse")}
          </button>
        </div>
      )}
    </div>
  );
}
