import type { RefObject } from "react";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { PlaybackBar } from "./PlaybackBar";
import { PreviewCanvas, type PreviewCanvasHandle } from "./PreviewCanvas";
import { PreviewTopStrip } from "./PreviewTopStrip";

type RendererPreference = "auto" | "webgl2" | "canvas2d";

interface PreviewAreaProps {
  previewRef?: RefObject<PreviewCanvasHandle | null>;
  rendererPreference?: RendererPreference;
  onRendererPreferenceChange?: (preference: RendererPreference) => void;
}

export function PreviewArea({
  previewRef,
  rendererPreference = "auto",
  onRendererPreferenceChange = () => undefined,
}: PreviewAreaProps) {
  const resolution = useEditorProjectStore((state) => state.resolution);
  const durationMs = useEditorProjectStore((state) => state.durationMs);

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
      <PlaybackBar />
    </div>
  );
}
