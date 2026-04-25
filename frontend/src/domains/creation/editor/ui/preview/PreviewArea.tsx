import type { RefObject } from "react";
import { PlaybackBar } from "./PlaybackBar";
import { PreviewCanvas, type PreviewCanvasHandle } from "./PreviewCanvas";
import { PreviewTopStrip } from "./PreviewTopStrip";

type RendererPreference = "auto" | "webgl2" | "canvas2d";

interface PreviewAreaProps {
  resolution?: string;
  durationMs?: number;
  previewRef?: RefObject<PreviewCanvasHandle | null>;
  rendererPreference?: RendererPreference;
  onRendererPreferenceChange?: (preference: RendererPreference) => void;
}

export function PreviewArea({
  resolution = "1080x1920",
  durationMs = 0,
  previewRef,
  rendererPreference = "auto",
  onRendererPreferenceChange = () => undefined,
}: PreviewAreaProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <PreviewTopStrip
        resolution={resolution}
        rendererPreference={rendererPreference}
        onRendererPreferenceChange={onRendererPreferenceChange}
      />
      <PreviewCanvas
        ref={previewRef}
        resolution={resolution}
        durationMs={durationMs}
      />
      <PlaybackBar durationMs={durationMs} />
    </div>
  );
}
