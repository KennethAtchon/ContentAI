import { useEffect, useState, type RefObject } from "react";

/**
 * Computes the stage surface size that fits inside the available preview panel
 * while preserving the project's output aspect ratio.
 *
 * Separating this from the renderer keeps layout measurement isolated from
 * scene derivation and media lifecycle work, which makes the preview shell
 * easier to reason about and reuse.
 */
export function usePreviewSurfaceSize(
  outerRef: RefObject<HTMLElement | null>,
  resolution: string
) {
  const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);
  const [previewSize, setPreviewSize] = useState<{ h: number; w: number } | null>(
    null
  );

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const compute = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight - 40;
      if (availW <= 0 || availH <= 0) return;
      const ratio = resW / resH;
      if (availW / availH >= ratio) {
        setPreviewSize({ w: availH * ratio, h: availH });
      } else {
        setPreviewSize({ w: availW, h: availW / ratio });
      }
    };

    compute();
    const ResizeObserverImpl = window.ResizeObserver;
    if (!ResizeObserverImpl) return;
    const observer = new ResizeObserverImpl(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [outerRef, resH, resW]);

  return {
    previewSize,
    resolutionHeight: resH,
    resolutionWidth: resW,
  };
}
