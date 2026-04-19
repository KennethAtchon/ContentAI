import type { RefObject } from "react";
import type { PreviewCanvasHandle } from "./PreviewCanvas";
import { PreviewCanvas } from "./PreviewCanvas";
import { PreviewTopStrip } from "./PreviewTopStrip";
import { PlaybackBar } from "./PlaybackBar";
import { useEditorDocumentContext } from "../../context/EditorDocumentContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";

interface PreviewAreaProps {
  previewRef: RefObject<PreviewCanvasHandle | null>;
}

export function PreviewArea({ previewRef }: PreviewAreaProps) {
  const { resolution, durationMs } = useEditorDocumentContext();
  const { playheadMs } = useEditorPlaybackContext();

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <PreviewTopStrip resolution={resolution} />
      <PreviewCanvas
        ref={previewRef}
        resolution={resolution}
        playheadMs={playheadMs}
        durationMs={durationMs}
      />
      <PlaybackBar />
    </div>
  );
}
