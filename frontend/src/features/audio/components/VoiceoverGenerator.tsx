import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  AlertCircle,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react";
import { VoiceSelector } from "./VoiceSelector";
import { SpeedToggle } from "./SpeedToggle";
import { useVoices } from "../hooks/use-voices";
import { useGenerateVoiceover } from "../hooks/use-generate-voiceover";
import type { TTSSpeed } from "../types/audio.types";

interface VoiceoverGeneratorProps {
  generatedContentId: number;
  generatedScript: string | null;
  generatedHook: string | null;
  onSuccess: (audioUrl: string) => void;
  onCancel?: () => void;
}

type ScriptMode = "script" | "hook";

export function VoiceoverGenerator({
  generatedContentId,
  generatedScript,
  generatedHook,
  onSuccess,
  onCancel,
}: VoiceoverGeneratorProps) {
  const { t } = useTranslation();
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [speed, setSpeed] = useState<TTSSpeed>("normal");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<ScriptMode>("script");

  const canonical =
    mode === "script"
      ? (generatedScript ?? generatedHook ?? "")
      : (generatedHook ?? "");
  const [scriptValue, setScriptValue] = useState(canonical);
  const isModified = scriptValue !== canonical;

  // Sync local value when mode changes
  useEffect(() => {
    setScriptValue(canonical);
  }, [mode, canonical]);

  const showModeToggle = !!generatedScript && !!generatedHook;
  const usingHookFallback = !generatedScript && !!generatedHook;

  const wordCount = scriptValue.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds =
    wordCount > 0 ? Math.round((wordCount / 150) * 60) : 0;

  const {
    data: voicesData,
    isLoading: voicesLoading,
    isError: voicesError,
    refetch: refetchVoices,
  } = useVoices();
  const generateMutation = useGenerateVoiceover();

  const voices = voicesData?.voices ?? [];
  const isGenerating = generateMutation.isPending;

  const handleCopy = async () => {
    if (!scriptValue) return;
    await navigator.clipboard.writeText(scriptValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    if (!selectedVoiceId) return;
    setError(null);

    try {
      const result = await generateMutation.mutateAsync({
        generatedContentId,
        text: scriptValue,
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
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={isGenerating}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start disabled:opacity-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("audio_generate_back")}
        </button>
      )}
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

      {/* Script section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("audio_generate_script_label")}
            </label>
            {showModeToggle && (
              <div className="flex items-center rounded-md border border-border/50 overflow-hidden">
                <button
                  onClick={() => setMode("script")}
                  className={`text-[10px] px-2 py-0.5 transition-colors ${
                    mode === "script"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("audio_generate_mode_script")}
                </button>
                <button
                  onClick={() => setMode("hook")}
                  className={`text-[10px] px-2 py-0.5 transition-colors border-l border-border/50 ${
                    mode === "hook"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("audio_generate_mode_hook")}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => void handleCopy()}
            disabled={!scriptValue}
            className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
            aria-label={t("audio_generate_copy_script")}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {usingHookFallback && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {t("audio_generate_hook_fallback")}
          </p>
        )}

        <textarea
          value={scriptValue}
          onChange={(e) => setScriptValue(e.target.value)}
          placeholder={t("audio_generate_script_placeholder")}
          spellCheck
          disabled={isGenerating}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed min-h-32 max-h-64 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <div className="flex items-center justify-between">
          {isModified ? (
            <button
              onClick={() => setScriptValue(canonical)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              {t("audio_generate_reset_script")}
            </button>
          ) : (
            <span />
          )}
          {wordCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {t("audio_generate_word_count", {
                words: wordCount,
                seconds: estimatedSeconds,
              })}
            </span>
          )}
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
        disabled={isGenerating || !selectedVoiceId || !scriptValue.trim()}
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
