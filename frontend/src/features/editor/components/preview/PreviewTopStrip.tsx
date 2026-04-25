import { useState } from "react";
import { Grid, Maximize2 } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";

type CompositorRendererPreference = "auto" | "webgl2" | "canvas2d";

interface PreviewTopStripProps {
  resolution: string;
  rendererPreference: CompositorRendererPreference;
  onRendererPreferenceChange: (
    preference: CompositorRendererPreference
  ) => void;
}

export function PreviewTopStrip({
  resolution,
  rendererPreference,
  onRendererPreferenceChange,
}: PreviewTopStripProps) {
  const [quality, setQuality] = useState<"Full" | "½" | "¼">("Full");
  const [showGrid, setShowGrid] = useState(false);
  const [showSafeAreas, setShowSafeAreas] = useState(false);

  return (
    <div
      className="flex items-center px-3 bg-studio-surface border-b border-overlay-sm shrink-0"
      style={{ height: 40 }}
    >
      <span className="text-[9px] font-bold text-red-500/80 mr-2 tracking-wider">
        ● REC&nbsp;·&nbsp;PREVIEW
      </span>
      <span className="text-[10px] text-dim-3">{resolution}</span>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        {(["Full", "½", "¼"] as const).map((q) => (
          <button
            key={q}
            onClick={() => setQuality(q)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded cursor-pointer border transition-colors",
              quality === q
                ? "bg-studio-accent/20 border-studio-accent/60 text-studio-accent"
                : "bg-transparent border-overlay-md text-dim-3 hover:text-dim-1"
            )}
          >
            {q}
          </button>
        ))}
        <div className="w-px h-4 bg-overlay-md mx-1 shrink-0" />
        {(["webgl2", "canvas2d"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onRendererPreferenceChange(mode)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded cursor-pointer border transition-colors uppercase",
              rendererPreference === mode
                ? "bg-studio-accent/20 border-studio-accent/60 text-studio-accent"
                : "bg-transparent border-overlay-md text-dim-3 hover:text-dim-1"
            )}
            title={`Use ${mode === "webgl2" ? "WebGL2" : "Canvas 2D"} compositor`}
          >
            {mode === "webgl2" ? "GL" : "2D"}
          </button>
        ))}
        <div className="w-px h-4 bg-overlay-md mx-1 shrink-0" />
        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle grid"
          className={cn(
            "transport-btn",
            showGrid && "text-studio-accent bg-studio-accent/10"
          )}
        >
          <Grid size={13} />
        </button>
        <button
          onClick={() => setShowSafeAreas(!showSafeAreas)}
          title="Toggle safe areas"
          className={cn(
            "transport-btn",
            showSafeAreas && "text-studio-accent bg-studio-accent/10"
          )}
        >
          <Maximize2 size={13} />
        </button>
      </div>
    </div>
  );
}
