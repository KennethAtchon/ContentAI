import { useState, useEffect, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Music, Loader2, Play, Square } from "lucide-react";
import { Slider } from "@/shared/components/ui/slider";
import { useAudioPlayback } from "../contexts/AudioPlaybackContext";

interface VolumeBalanceProps {
  value: number; // 0–100, voiceover percentage
  onChange: (value: number) => void;
  disabled?: boolean;
  isSaving?: boolean;
  voiceoverUrl?: string;
  musicUrl?: string;
}

export function VolumeBalance({
  value,
  onChange,
  disabled,
  isSaving,
  voiceoverUrl,
  musicUrl,
}: VolumeBalanceProps) {
  const { t } = useTranslation();
  const mixId = useId();
  const { currentPlayerId, play, stop } = useAudioPlayback();

  const [localValue, setLocalValue] = useState(value);
  const [mixPlaying, setMixPlaying] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Stop mix when another player takes over
  useEffect(() => {
    if (currentPlayerId !== mixId && mixPlaying) {
      voiceRef.current?.pause();
      musicRef.current?.pause();
      setMixPlaying(false);
    }
  }, [currentPlayerId, mixId, mixPlaying]);

  // Update live volumes as slider moves
  useEffect(() => {
    if (voiceRef.current) voiceRef.current.volume = localValue / 100;
    if (musicRef.current) musicRef.current.volume = (100 - localValue) / 100;
  }, [localValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceRef.current?.pause();
      musicRef.current?.pause();
    };
  }, []);

  const handleChange = (values: number[]) => {
    const newValue = values[0];
    setLocalValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(newValue), 300);
  };

  const handleMixPlay = async () => {
    const voice = voiceRef.current;
    const music = musicRef.current;
    if (!voice || !music) return;
    play(mixId);
    voice.volume = localValue / 100;
    music.volume = (100 - localValue) / 100;
    voice.currentTime = 0;
    music.currentTime = 0;
    await Promise.all([voice.play(), music.play()]);
    setMixPlaying(true);
  };

  const handleMixStop = () => {
    voiceRef.current?.pause();
    musicRef.current?.pause();
    setMixPlaying(false);
    stop();
  };

  const canPreview = !!(voiceoverUrl && musicUrl);
  const voicePct = localValue;
  const musicPct = 100 - localValue;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("audio_mix_sectionTitle")}
        </span>
        <div className="flex items-center gap-1.5">
          {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/40" />}
          {canPreview && (
            <button
              onClick={mixPlaying ? handleMixStop : () => void handleMixPlay()}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
            >
              {mixPlaying ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-current" />
                  {t("audio_mix_stop")}
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  {t("audio_mix_preview")}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Hidden audio elements for mix preview */}
      {voiceoverUrl && (
        <audio ref={voiceRef} src={voiceoverUrl} onEnded={handleMixStop} className="hidden" />
      )}
      {musicUrl && (
        <audio ref={musicRef} src={musicUrl} onEnded={handleMixStop} className="hidden" />
      )}

      {/* Balance chips + slider */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-primary/8 border border-primary/15">
          <Mic className="w-3 h-3 text-primary/70" />
          <span className="text-[11px] font-semibold tabular-nums text-primary/80 min-w-[22px] text-right">
            {voicePct}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[localValue]}
          onValueChange={handleChange}
          disabled={disabled}
          className="flex-1"
        />
        <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-violet-500/8 border border-violet-500/15">
          <span className="text-[11px] font-semibold tabular-nums text-violet-500/80 min-w-[22px] text-left">
            {musicPct}%
          </span>
          <Music className="w-3 h-3 text-violet-500/70" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between px-[2px]">
        <span className="text-[10px] text-muted-foreground/50">{t("audio_volume_voice")}</span>
        <span className="text-[10px] text-muted-foreground/50">{t("audio_volume_music")}</span>
      </div>
    </div>
  );
}
