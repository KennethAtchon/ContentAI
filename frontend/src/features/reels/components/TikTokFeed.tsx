import { useRef, useEffect, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  const [containerHeight, setContainerHeight] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure container height for virtualizer item size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new window.ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: reels.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => containerHeight || 600,
    overscan: 1,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Programmatic scroll using virtualizer
  const programmaticScroll = useCallback(
    (reelId: number) => {
      const idx = reels.findIndex((r) => r.id === reelId);
      if (idx === -1) return;

      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      onActiveChange(reelId);
      rowVirtualizer.scrollToIndex(idx, { behavior: "smooth" });

      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 600);
    },
    [reels, onActiveChange, rowVirtualizer],
  );

  // IntersectionObserver on virtual items
  useEffect(() => {
    const container = containerRef.current;
    if (!container || containerHeight === 0) return;

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
      { root: container, threshold: 0.6 },
    );

    for (const virtualRow of virtualItems) {
      const el = container.querySelector(
        `[data-reel-id="${reels[virtualRow.index]?.id}"]`,
      );
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [virtualItems, reels, activeId, onActiveChange, containerHeight]);

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
      className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const reel = reels[virtualRow.index];
          if (!reel) return null;
          return (
            <div
              key={reel.id}
              data-reel-id={reel.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TikTokVideoCard
                reel={reel}
                isActive={activeId === reel.id}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted((m) => !m)}
                onAnalyze={onAnalyze}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
