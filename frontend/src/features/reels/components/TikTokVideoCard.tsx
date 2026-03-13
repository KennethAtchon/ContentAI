import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fmtNum, useReelMediaUrl } from "../hooks/use-reels";
import { cn } from "@/shared/utils/helpers/utils";
import type { Reel } from "../types/reel.types";

interface Props {
  reel: Reel;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onAnalyze: (id: number) => void;
}

export function TikTokVideoCard({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  onAnalyze,
}: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const hasVideo = !!(reel.videoUrl || reel.videoR2Url);
  const { data: mediaData } = useReelMediaUrl(
    isActive ? reel.id : null,
    hasVideo
  );
  const videoSrc = mediaData?.url ?? null;

  // Play/pause based on active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && !isPaused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive, isPaused, videoSrc]);

  // Mute sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [videoSrc]);

  const handleClick = useCallback(() => {
    if (!videoRef.current) return;
    if (isPaused) {
      videoRef.current.play().catch(() => {});
      setIsPaused(false);
    } else {
      videoRef.current.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  return (
    <div className="relative w-full h-full snap-start snap-always flex items-center justify-center bg-black">
      {/* Video or thumbnail fallback */}
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          loop
          playsInline
          muted={isMuted}
          onClick={handleClick}
          onWaiting={() => setIsBuffering(true)}
          onCanPlay={() => setIsBuffering(false)}
          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        />
      ) : reel.thumbnailUrl ? (
        <img
          src={reel.thumbnailUrl}
          alt={reel.username}
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] to-[#16213E] flex items-center justify-center">
          <span className="text-[80px]">{reel.thumbnailEmoji ?? "🎬"}</span>
        </div>
      )}

      {/* Pause icon overlay */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && isActive && videoSrc && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* No video badge */}
      {!hasVideo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm text-white/70 text-[11px] font-medium px-3 py-1.5 rounded-full">
          {t("studio_feed_noVideo")}
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-[1]" />

      {/* Top gradient */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none z-[1]" />

      {/* Bottom-left info overlay */}
      <div className="absolute bottom-4 left-3 right-16 z-10">
        <p className="text-[14px] font-bold text-white drop-shadow-lg mb-1">
          @{reel.username}
        </p>
        {reel.hook && (
          <p
            className={cn(
              "text-[13px] text-white/90 leading-[1.45] drop-shadow-md cursor-pointer",
              !captionExpanded && "line-clamp-2"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setCaptionExpanded(!captionExpanded);
            }}
          >
            {reel.hook}
          </p>
        )}
        {reel.audioName && (
          <div className="flex items-center gap-1.5 mt-2 text-[12px] text-white/60">
            <span className="inline-block w-3.5 h-3.5 rounded-full bg-white/20 text-center text-[10px] leading-[14px]">
              ♪
            </span>
            <span className="truncate max-w-[180px]">{reel.audioName}</span>
          </div>
        )}
      </div>

      {/* Right side action column */}
      <div className="absolute right-2.5 bottom-24 flex flex-col items-center gap-5 z-10">
        <ActionButton
          icon="❤️"
          label={fmtNum(reel.likes)}
          onClick={(e) => e.stopPropagation()}
        />
        <ActionButton
          icon="💬"
          label={fmtNum(reel.comments)}
          onClick={(e) => e.stopPropagation()}
        />
        <ActionButton
          icon="📊"
          label={t("studio_feed_analyze")}
          onClick={(e) => {
            e.stopPropagation();
            onAnalyze(reel.id);
          }}
        />
        <ActionButton
          icon={isMuted ? "🔇" : "🔊"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
        />
      </div>

      {/* Top-right: engagement badge */}
      <div className="absolute top-3 right-3 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center">
        <p className="text-[10px] text-white/50">
          {t("studio_panel_engagement")}
        </p>
        <p className="text-[14px] font-bold text-studio-accent">
          {reel.engagementRate ?? "0"}%
        </p>
      </div>

      {/* Top-left: views badge */}
      <div className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
        <span className="text-[10px] text-white/50">▶</span>
        <span className="text-[13px] font-bold text-white">
          {fmtNum(reel.views)}
        </span>
      </div>

      {/* Bottom progress bar */}
      {videoSrc && (
        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/10 z-20">
          <div
            className="h-full bg-white/80 transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer group"
    >
      <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg transition-transform group-hover:scale-110 group-active:scale-95">
        {icon}
      </div>
      {label && (
        <span className="text-[11px] text-white font-semibold drop-shadow-md">
          {label}
        </span>
      )}
    </button>
  );
}
