import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { Voice } from "../types/audio.types";
import { VoiceCard } from "./VoiceCard";

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function VoiceSelector({
  voices,
  selectedVoiceId,
  onSelect,
  isLoading,
  disabled,
  error,
  onRetry,
}: VoiceSelectorProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="w-[120px] h-[140px] shrink-0 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-base text-muted-foreground">
          {t("audio_voices_loadError")}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            {t("audio_voices_retry")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {voices.map((voice) => (
        <VoiceCard
          key={voice.id}
          voice={voice}
          isSelected={selectedVoiceId === voice.id}
          onSelect={() => onSelect(voice.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
