import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { CaptionClip } from "../../types/editor";
import { buildPages } from "../page-builder";
import { sliceTokensToRange } from "../slice-tokens";
import { computeLayout } from "../layout-engine";
import { renderFrame } from "../renderer";
import { FontLoader } from "../font-loader";
import type { CaptionDoc, TextPreset } from "../types";

interface UseCaptionCanvasParams {
  clip: CaptionClip | null;
  doc: CaptionDoc | null;
  preset: TextPreset | null;
  canvasW: number;
  canvasH: number;
  onBitmapReady?: (bitmap: ImageBitmap | null) => void;
}

interface UseCaptionCanvasResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  renderAtTime: (currentTimeMs: number) => void;
}

export function useCaptionCanvas({
  clip,
  doc,
  preset,
  canvasW,
  canvasH,
  onBitmapReady,
}: UseCaptionCanvasParams): UseCaptionCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fontLoader = useMemo(() => new FontLoader(), []);
  const lastRenderedKeyRef = useRef<string | null>(null);
  const renderTokenRef = useRef(0);
  const lastRequestedTimeRef = useRef<number | null>(null);

  const renderAtTime = useCallback(
    (currentTimeMs: number) => {
      lastRequestedTimeRef.current = currentTimeMs;
      const renderToken = renderTokenRef.current + 1;
      renderTokenRef.current = renderToken;

      const isStale = () => renderTokenRef.current !== renderToken;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const clearCanvas = () => {
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastRenderedKeyRef.current = null;
      };

      const hasCaptionFrame = !!clip && !!doc && !!preset;
      if (!hasCaptionFrame) {
        clearCanvas();
        onBitmapReady?.(null);
        return;
      }

      const run = async () => {
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (preset.typography.fontUrl) {
          await fontLoader.load(
            preset.typography.fontFamily,
            preset.typography.fontUrl
          );
          if (isStale()) return;
        }

        const tokens = sliceTokensToRange(
          doc.tokens,
          clip.sourceStartMs,
          clip.sourceEndMs
        );
        const pages = buildPages(tokens, clip.groupingMs || preset.groupingMs);
        const relativeMs = currentTimeMs - clip.startMs;
        const page =
          pages.find(
            (candidate) =>
              relativeMs >= candidate.startMs && relativeMs < candidate.endMs
          ) ?? null;
        if (!page) {
          if (!isStale()) {
            onBitmapReady?.(null);
          }
          return;
        }

        const renderKey = `${clip.id}:${page.startMs}:${page.endMs}:${canvas.width}:${canvas.height}:${Math.round(relativeMs)}`;
        if (renderKey === lastRenderedKeyRef.current) return;
        lastRenderedKeyRef.current = renderKey;

        const layout = computeLayout(
          ctx,
          page,
          preset,
          canvas.width,
          canvas.height
        );
        renderFrame(ctx, layout, relativeMs, preset);
        if (onBitmapReady) {
          const bitmap = await window.createImageBitmap(canvas);
          if (isStale()) {
            bitmap.close();
            return;
          }
          onBitmapReady(bitmap);
        }
      };

      void run();
    },
    [clip, doc, preset, canvasW, canvasH, fontLoader, onBitmapReady]
  );

  useEffect(() => {
    if (lastRequestedTimeRef.current != null) {
      renderAtTime(lastRequestedTimeRef.current);
      return;
    }

    if (clip) {
      renderAtTime(clip.startMs);
      return;
    }

    renderAtTime(0);
  }, [clip, doc, preset, canvasW, canvasH, renderAtTime]);

  useEffect(() => {
    return () => {
      renderTokenRef.current += 1;
    };
  }, []);

  return { canvasRef, renderAtTime };
}
