import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { VoiceSelector } from "./VoiceSelector";
import { SpeedToggle } from "./SpeedToggle";
import { useVoices } from "../hooks/use-voices";
import { useGenerateVoiceover } from "../hooks/use-generate-voiceover";
import type { TTSSpeed } from "../types/audio.types";

interface VoiceoverGeneratorProps {
  generatedContentId: number;
  scriptText: string;
  onSuccess: (audioUrl: string) => void;
}

export function VoiceoverGenerator({
  generatedContentId,
  scriptText,
  onSuccess,
}: VoiceoverGeneratorProps) {
  const { t } = useTranslation();
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [speed, setSpeed] = useState<TTSSpeed>("normal");
  const [error, setError] = useState<string | null>(null);

  const {
    data: voicesData,
    isLoading: voicesLoading,
    isError: voicesError,
    refetch: refetchVoices,
  } = useVoices();
  const generateMutation = useGenerateVoiceover();

  const voices = voicesData?.voices ?? [];
  const isGenerating = generateMutation.isPending;

  const handleGenerate = async () => {
    if (!selectedVoiceId) return;
    setError(null);

    try {
      const result = await generateMutation.mutateAsync({
        generatedContentId,
        text: scriptText,
        voiceId: selectedVoiceId,
        speed,
      });
      onSuccess(result.audioUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("TEXT_TOO_LONG")) {
        setError(t("audio_generate_errorTextTooLong"));
      } else if (message.includes("TTS_PROVIDER_ERROR")) {
        setError(t("audio_generate_errorProvider"));
      } else if (message.includes("USAGE_LIMIT_REACHED")) {
        setError(t("audio_generate_errorLimit"));
      } else {
        setError(t("audio_generate_errorDefault"));
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Mic className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t("audio_generate_title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("audio_generate_subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          {t("audio_voices_label")}
        </label>
        <VoiceSelector
          voices={voices}
          selectedVoiceId={selectedVoiceId}
          onSelect={setSelectedVoiceId}
          isLoading={voicesLoading}
          disabled={isGenerating}
          error={voicesError}
          onRetry={() => void refetchVoices()}
        />
      </div>

      <SpeedToggle value={speed} onChange={setSpeed} disabled={isGenerating} />

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{error}</p>
            <button
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !selectedVoiceId}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              {t("audio_generate_tryAgain")}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => void handleGenerate()}
        disabled={isGenerating || !selectedVoiceId || !scriptText}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("audio_generate_generating")}
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            {t("audio_generate_button")}
          </>
        )}
      </button>
    </div>
  );
}
