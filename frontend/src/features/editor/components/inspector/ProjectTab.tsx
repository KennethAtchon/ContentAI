import { useTranslation } from "react-i18next";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEditorContext } from "../../context/EditorContext";
import { InspectorSection } from "./InspectorSection";
import { InspectorPropRow, InspectorValuePill } from "./InspectorPropRow";
import { ResolutionPicker } from "../dialogs/ResolutionPicker";

const RESOLUTION_LABEL_MAP: Record<string, string> = {
  "720x1280": "9:16 SD (720p)",
  "1080x1920": "9:16 HD (1080p)",
  "2160x3840": "9:16 4K",
  "1920x1080": "16:9 Landscape",
  "1080x1080": "1:1 Square",
};

interface ProjectTabProps {
  onFpsChange: (fps: 24 | 25 | 30 | 60) => void;
  onResolutionChange: (resolution: string) => void;
  isCapturingThumbnail: boolean;
  onCaptureThumbnail: () => void;
}

export function ProjectTab({
  onFpsChange,
  onResolutionChange,
  isCapturingThumbnail,
  onCaptureThumbnail,
}: ProjectTabProps) {
  const { t } = useTranslation();
  const { state } = useEditorContext();

  return (
    <div className="p-3">
      <InspectorSection title={t("editor_project_section_info")}>
        <InspectorPropRow label={t("editor_project_duration")}>
          <InspectorValuePill value={`${(state.durationMs / 1000).toFixed(1)}s`} />
        </InspectorPropRow>
        <InspectorPropRow label={t("editor_project_clips")}>
          <InspectorValuePill
            value={state.tracks.reduce((n, tr) => n + tr.clips.length, 0)}
          />
        </InspectorPropRow>
      </InspectorSection>

      <InspectorSection title={t("editor_project_section_settings")}>
        <InspectorPropRow label={t("editor_project_resolution")}>
          <ResolutionPicker
            resolution={state.resolution}
            onChange={(res) => {
              onResolutionChange(res);
              const label = RESOLUTION_LABEL_MAP[res] ?? res;
              toast.success(t("editor_resolution_changed", { resolution: label }));
            }}
          />
        </InspectorPropRow>
        <InspectorPropRow label={t("editor_project_fps")}>
          <select
            value={String(state.fps)}
            onChange={(e) => onFpsChange(Number(e.target.value) as 24 | 25 | 30 | 60)}
            className="h-6 rounded border border-overlay-md bg-transparent px-2 text-xs text-dim-2 outline-none"
          >
            {[24, 25, 30, 60].map((v) => (
              <option key={v} value={v} className="bg-studio-surface text-dim-1">
                {v} fps
              </option>
            ))}
          </select>
        </InspectorPropRow>
      </InspectorSection>

      <InspectorSection title={t("editor_project_section_thumbnail")}>
        <button
          onClick={onCaptureThumbnail}
          disabled={isCapturingThumbnail}
          className="flex items-center gap-1.5 text-xs text-dim-2 hover:text-dim-1 bg-overlay-sm border border-overlay-sm px-3 py-1.5 rounded cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {isCapturingThumbnail ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Camera size={12} />
          )}
          {t("editor_set_thumbnail")}
        </button>
      </InspectorSection>
    </div>
  );
}
