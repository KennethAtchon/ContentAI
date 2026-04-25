import { useTranslation } from "react-i18next";
import { RefreshCw, Mic } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import type { ReelAsset } from "../model/audio.types";

interface VoiceoverPlayerProps {
  asset: ReelAsset;
  audioUrl: string;
  onRegenerate: () => void;
}

export function VoiceoverPlayer({
  asset,
  audioUrl,
  onRegenerate,
}: VoiceoverPlayerProps) {
  const { t } = useTranslation();
  const meta = asset.metadata as Record<string, string> | null;
  const voiceName = meta?.voiceName ?? "";
  const speed = meta?.speed ?? "normal";
  const durationSec = asset.durationMs ? asset.durationMs / 1000 : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("audio_voiceover_sectionTitle")}
        </span>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {t("audio_voiceover_regenerate")}
        </button>
      </div>

      {/* Voice info + player */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Mic className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{voiceName}</p>
          <p className="text-sm text-muted-foreground capitalize">
            {speed} {t("audio_speed_label").toLowerCase()}
          </p>
        </div>
      </div>

      <AudioPlayer
        src={audioUrl}
        duration={durationSec}
        variant="full"
        downloadFilename={`voiceover-${asset.id}.mp3`}
      />
    </div>
  );
}
