import { useTranslation } from "react-i18next";
import { RefreshCw, Mic } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import type { ReelAsset } from "../types/audio.types";

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
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Mic className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium">{voiceName}</p>
          <p className="text-[10px] text-muted-foreground capitalize">
            {speed} {t("audio_speed_label").toLowerCase()}
          </p>
        </div>
        <button
          onClick={onRegenerate}
          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {t("audio_voiceover_regenerate")}
        </button>
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
