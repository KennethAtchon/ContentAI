import { useState, useCallback, type RefObject } from "react";
import type { AudioClip, MusicClip, Track, VideoClip } from "../types/editor";
import { parseTimelineAssetDragPayload } from "../utils/timeline-asset-drag-payload";
import { ASSET_TYPE_TO_TRACK } from "../constants/timeline-layout";

export function useTimelineAssetDrop(options: {
  scrollRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  onAddClip: (
    trackId: string,
    clip: VideoClip | AudioClip | MusicClip
  ) => void;
}) {
  const { scrollRef, zoom, onAddClip } = options;
  const [dropTargetTrackId, setDropTargetTrackId] = useState<string | null>(null);
  const [rejectTargetTrackId, setRejectTargetTrackId] = useState<string | null>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent, track: Track) => {
      if (!e.dataTransfer.types.includes("application/x-contentai-asset")) return;
      if (track.locked) return;

      const assetType = ["video_clip", "assembled_video", "image", "voiceover", "music"].find(
        (t) => e.dataTransfer.types.includes(`application/x-contentai-type-${t}`)
      );
      const expectedTrack = assetType ? ASSET_TYPE_TO_TRACK[assetType] : undefined;
      const isValid = !expectedTrack || expectedTrack === track.type;

      if (isValid) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropTargetTrackId(track.id);
        setRejectTargetTrackId(null);
      } else {
        e.dataTransfer.dropEffect = "none";
        setDropTargetTrackId(null);
        setRejectTargetTrackId(track.id);
      }
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetTrackId(null);
    setRejectTargetTrackId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, track: Track) => {
      setDropTargetTrackId(null);
      if (!e.dataTransfer.types.includes("application/x-contentai-asset")) return;
      if (track.locked) return;
      if (track.type === "text") return;
      e.preventDefault();

      const raw = e.dataTransfer.getData("application/x-contentai-asset");
      if (!raw) return;

      const asset = parseTimelineAssetDragPayload(raw);
      if (!asset) return;

      const expectedTrack = ASSET_TYPE_TO_TRACK[asset.type];
      if (expectedTrack && expectedTrack !== track.type) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const startMs = Math.max(0, ((e.clientX - rect.left + scrollLeft) / zoom) * 1000);

      const clip: VideoClip | AudioClip | MusicClip = {
        id: crypto.randomUUID(),
        type: track.type,
        assetId: asset.assetId,
        label: asset.label,
        startMs,
        durationMs: asset.durationMs,
        sourceMaxDurationMs: asset.durationMs,
        trimStartMs: 0,
        trimEndMs: 0,
        speed: 1,
        opacity: 1,
        warmth: 0,
        contrast: 0,
        positionX: 0,
        positionY: 0,
        scale: 1,
        rotation: 0,
        volume: track.type === "music" ? 0.3 : 1,
        muted: false,
      };

      onAddClip(track.id, clip);
    },
    [onAddClip, scrollRef, zoom]
  );

  return {
    dropTargetTrackId,
    rejectTargetTrackId,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
