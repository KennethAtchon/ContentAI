import { useRef, useEffect, useState, useCallback } from "react";
import { TikTokVideoCard } from "./TikTokVideoCard";
import type { Reel } from "../types/reel.types";

interface Props {
  reels: Reel[];
  activeId: number | null;
  onActiveChange: (id: number) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onAnalyze: (id: number) => void;
}

export function TikTokFeed({
  reels,
  activeId,
  onActiveChange,
  onLoadMore,
  hasMore,
  onAnalyze,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock observer during programmatic scrolls
  const programmaticScroll = useCallback(
    (reelId: number) => {
      const el = cardRefs.current.get(reelId);
      if (!el) return;

      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      onActiveChange(reelId);
      el.scrollIntoView({ behavior: "smooth", block: "start" });

      // Unlock after scroll settles
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 600);
    },
    [onActiveChange],
  );

  // Intersection Observer — only updates active reel during user-initiated scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const reelId = Number(entry.target.getAttribute("data-reel-id"));
            if (reelId && reelId !== activeId) {
              onActiveChange(reelId);
            }
          }
        }
      },
      {
        root: container,
        threshold: 0.6,
      },
    );

    for (const el of cardRefs.current.values()) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [reels, activeId, onActiveChange]);

  // Load more when near the end
  useEffect(() => {
    if (!activeId || !hasMore) return;
    const idx = reels.findIndex((r) => r.id === activeId);
    if (idx >= reels.length - 3) {
      onLoadMore();
    }
  }, [activeId, reels, hasMore, onLoadMore]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = reels.findIndex((r) => r.id === activeId);
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(idx + 1, reels.length - 1)
            : Math.max(idx - 1, 0);
        if (nextIdx !== idx) {
          programmaticScroll(reels[nextIdx].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reels, activeId, programmaticScroll]);

  // Scroll to reel when activeId changes externally (e.g. sidebar click)
  const prevActiveId = useRef(activeId);
  useEffect(() => {
    if (activeId && activeId !== prevActiveId.current) {
      programmaticScroll(activeId);
    }
    prevActiveId.current = activeId;
  }, [activeId, programmaticScroll]);

  const setCardRef = useCallback(
    (reelId: number) => (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(reelId, el);
      else cardRefs.current.delete(reelId);
    },
    [],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  if (reels.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {reels.map((reel) => (
        <div
          key={reel.id}
          ref={setCardRef(reel.id)}
          data-reel-id={reel.id}
          className="h-full w-full snap-start snap-always shrink-0"
          style={{ minHeight: "100%" }}
        >
          <TikTokVideoCard
            reel={reel}
            isActive={activeId === reel.id}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((m) => !m)}
            onAnalyze={onAnalyze}
          />
        </div>
      ))}
    </div>
  );
}
