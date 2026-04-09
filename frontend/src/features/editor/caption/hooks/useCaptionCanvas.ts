import { useEffect, useMemo, useRef } from "react";
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
  currentTimeMs: number;
  canvasW: number;
  canvasH: number;
}

export function useCaptionCanvas({
  clip,
  doc,
  preset,
  currentTimeMs,
  canvasW,
  canvasH,
}: UseCaptionCanvasParams): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fontLoader = useMemo(() => new FontLoader(), []);
  const lastRenderedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const hasCaptionFrame = !!clip && !!doc && !!preset;
    if (!hasCaptionFrame) {
      if (lastRenderedKeyRef.current !== null) {
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastRenderedKeyRef.current = null;
      }
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
      if (!page) return;

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
    };

    void run();
  }, [clip, doc, preset, currentTimeMs, canvasW, canvasH, fontLoader]);

  return canvasRef;
}
