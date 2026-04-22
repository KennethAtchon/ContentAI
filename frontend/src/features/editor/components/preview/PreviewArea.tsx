import type { RefObject } from "react";
import type { PreviewCanvasHandle } from "./PreviewCanvas";
import { PreviewCanvas } from "./PreviewCanvas";
import { PreviewTopStrip } from "./PreviewTopStrip";
import { PlaybackBar } from "./PlaybackBar";
import type { CompositorRendererPreference } from "../../engine/CompositorWorker";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";

interface PreviewAreaProps {
  previewRef: RefObject<PreviewCanvasHandle | null>;
  rendererPreference: CompositorRendererPreference;
  onRendererPreferenceChange: (
    preference: CompositorRendererPreference
  ) => void;
}

export function PreviewArea({
  previewRef,
  rendererPreference,
  onRendererPreferenceChange,
}: PreviewAreaProps) {
  const { resolution, durationMs } = useEditorDocumentState();
  const { playheadMs } = useEditorPlaybackContext();

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
        playheadMs={playheadMs}
        durationMs={durationMs}
        rendererPreference={rendererPreference}
        onRendererPreferenceChange={onRendererPreferenceChange}
      />
      <PlaybackBar />
    </div>
  );
}
