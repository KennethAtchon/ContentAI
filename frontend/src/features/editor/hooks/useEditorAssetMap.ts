import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useMediaLibrary } from "@/features/media/hooks/use-media-library";
import type { MediaItem } from "@/features/media/types/media.types";
import type { Track, VideoClip } from "../types/editor";
import { uploadProjectThumbnail } from "../services/editor-api";
import { isVideoClip } from "../utils/clip-types";

interface Asset {
  id: string;
  type: string;
  r2Url?: string;
  mediaUrl?: string;
  audioUrl?: string;
}

interface UseEditorAssetMapParams {
  projectId: string;
  generatedContentId: number | null;
  projectThumbnailUrl?: string | null;
  tracks: Track[];
  currentTimeMs: number;
}

function captureVideoFrame(url: string, timeMs: number): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    const cleanup = () => {
      video.src = "";
    };
    video.addEventListener(
      "error",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true }
    );
    video.addEventListener(
      "seeked",
      () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 568;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0);
          canvas.toBlob(
            (blob) => {
              cleanup();
              resolve(blob);
            },
            "image/jpeg",
            0.85
          );
        } catch {
          cleanup();
          resolve(null);
        }
      },
      { once: true }
    );
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = Math.max(0, timeMs / 1000);
      },
      { once: true }
    );
    video.src = url;
  });
}

export function useEditorAssetMap({
  projectId,
  generatedContentId,
  projectThumbnailUrl,
  tracks,
  currentTimeMs,
}: UseEditorAssetMapParams) {
  const { t } = useTranslation();
  const fetcher = useQueryFetcher<{ assets: Asset[] }>();
  const [isCapturingThumbnail, setIsCapturingThumbnail] = useState(false);
  const thumbnailCapturedRef = useRef(false);

  const { data: assetsData } = useQuery({
    queryKey: queryKeys.api.contentAssets(generatedContentId ?? 0),
    queryFn: () => fetcher(`/api/assets?generatedContentId=${generatedContentId}`),
    enabled: !!generatedContentId,
  });
  const { data: libraryData } = useMediaLibrary();

  const assetUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assetsData?.assets ?? []) {
      const url = a.mediaUrl ?? a.audioUrl ?? a.r2Url ?? "";
      if (url) map.set(a.id, url);
    }
    for (const item of (libraryData?.items ?? []) as MediaItem[]) {
      const url = item.mediaUrl ?? item.r2Url ?? "";
      if (url) map.set(item.id, url);
    }
    return map;
  }, [assetsData, libraryData]);

  const captureThumbnail = useCallback(
    async (atMs?: number) => {
      const videoTrack = tracks.find((track) => track.type === "video");
      const nowMs = atMs ?? currentTimeMs;
      const activeClip =
        videoTrack?.clips.find(
          (clip): clip is VideoClip =>
            isVideoClip(clip) &&
            !clip.isPlaceholder &&
            Boolean(clip.assetId) &&
            clip.startMs <= nowMs &&
            nowMs < clip.startMs + clip.durationMs
        ) ??
        videoTrack?.clips.find(
          (clip): clip is VideoClip =>
            isVideoClip(clip) && !clip.isPlaceholder && Boolean(clip.assetId)
        );
      const url = activeClip?.assetId ? assetUrlMap.get(activeClip.assetId) : undefined;
      if (!url) return;

      const seekMs = activeClip
        ? activeClip.trimStartMs + Math.max(0, nowMs - activeClip.startMs)
        : 0;

      setIsCapturingThumbnail(true);
      try {
        const blob = await captureVideoFrame(url, seekMs);
        if (!blob) return;
        await uploadProjectThumbnail(projectId, blob);
        toast.success(t("editor_thumbnail_saved"));
      } catch {
        toast.error(t("editor_thumbnail_failed"));
      } finally {
        setIsCapturingThumbnail(false);
      }
    },
    [tracks, currentTimeMs, assetUrlMap, projectId, t]
  );

  useEffect(() => {
    if (thumbnailCapturedRef.current) return;
    if (projectThumbnailUrl) {
      thumbnailCapturedRef.current = true;
      return;
    }
    if (assetUrlMap.size === 0) return;
    const videoTrack = tracks.find((track) => track.type === "video");
    const firstClip = videoTrack?.clips.find(
      (clip): clip is VideoClip =>
        isVideoClip(clip) && !clip.isPlaceholder && Boolean(clip.assetId)
    );
    if (!firstClip?.assetId) return;
    thumbnailCapturedRef.current = true;
    void captureThumbnail(0);
  }, [assetUrlMap, tracks, projectThumbnailUrl, captureThumbnail]);

  return {
    assetUrlMap,
    isCapturingThumbnail,
    captureThumbnail,
  };
}

