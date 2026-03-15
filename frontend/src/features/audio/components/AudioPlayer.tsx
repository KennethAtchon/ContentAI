import { useRef, useState, useEffect, useCallback, useId } from "react";
import { Play, Pause, Download, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioPlayback } from "../contexts/AudioPlaybackContext";

interface AudioPlayerProps {
  src: string;
  duration?: number;
  variant: "full" | "compact";
  onPlay?: () => void;
  onPause?: () => void;
  downloadFilename?: string;
  className?: string;
}

type PlayerState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  duration,
  variant,
  onPlay,
  onPause,
  downloadFilename,
  className = "",
}: AudioPlayerProps) {
  const { t } = useTranslation();
  const id = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const { currentPlayerId, play, stop } = useAudioPlayback();

  const [state, setState] = useState<PlayerState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);

  const isPlaying = currentPlayerId === id && state === "playing";

  // Stop playback when another player starts
  useEffect(() => {
    if (currentPlayerId !== id && state === "playing") {
      audioRef.current?.pause();
      setState("paused");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [currentPlayerId, id, state]);

  // Reset when src changes
  useEffect(() => {
    setState("idle");
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stop();
  }, [src]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state === "ended") {
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    setState("loading");
    play(id);
    try {
      await audio.play();
      setState("playing");
      onPlay?.();
      rafRef.current = requestAnimationFrame(updateProgress);
    } catch {
      setState("error");
      stop();
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setState("paused");
    onPause?.();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stop();
  };

  const handleEnded = () => {
    setState("ended");
    setCurrentTime(totalDuration || audioRef.current?.duration || 0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stop();
  };

  const handleError = () => {
    setState("error");
    stop();
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && audio.duration && isFinite(audio.duration)) {
      setTotalDuration(audio.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = downloadFilename || "voiceover.mp3";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <audio
          ref={audioRef}
          src={src}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          className="hidden"
        />
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label={
            isPlaying ? t("audio_player_pause") : t("audio_player_play")
          }
        >
          {state === "loading" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          disabled={state === "error"}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50"
          aria-label={
            isPlaying ? t("audio_player_pause") : t("audio_player_play")
          }
        >
          {state === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : state === "error" ? (
            <AlertCircle className="w-4 h-4" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          {state === "error" ? (
            <span className="text-xs text-destructive">
              {t("audio_player_playbackFailed")}
            </span>
          ) : (
            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 accent-primary cursor-pointer"
            />
          )}
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            {downloadFilename && (
              <button
                onClick={handleDownload}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                aria-label={t("audio_player_download")}
              >
                <Download className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
