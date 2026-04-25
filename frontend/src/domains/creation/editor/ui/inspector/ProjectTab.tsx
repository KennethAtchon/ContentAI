import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResolutionPicker } from "../dialogs/ResolutionPicker";
import { InspectorPropRow, InspectorValuePill } from "./InspectorPropRow";
import { InspectorSection } from "./InspectorSection";

interface ProjectTabProps {
  durationMs?: number;
  clipCount?: number;
  resolution?: string;
  fps?: number;
  onFpsChange?: (fps: 24 | 25 | 30 | 60) => void;
  onResolutionChange?: (resolution: string) => void;
  isCapturingThumbnail?: boolean;
  onCaptureThumbnail?: () => void;
}

export function ProjectTab({
  durationMs = 0,
  clipCount = 0,
  resolution = "1080x1920",
  fps = 30,
  onFpsChange,
  onResolutionChange,
  onCaptureThumbnail,
}: ProjectTabProps) {
  const { t } = useTranslation();

  return (
    <div className="p-3">
      <InspectorSection title={t("editor_project_section_info")}>
        <InspectorPropRow label={t("editor_project_duration")}>
          <InspectorValuePill value={`${(durationMs / 1000).toFixed(1)}s`} />
        </InspectorPropRow>
        <InspectorPropRow label={t("editor_project_clips")}>
          <InspectorValuePill value={clipCount} />
        </InspectorPropRow>
      </InspectorSection>

      <InspectorSection title={t("editor_project_section_settings")}>
        <InspectorPropRow label={t("editor_project_resolution")}>
          <ResolutionPicker
            resolution={resolution}
            onChange={(value) => onResolutionChange?.(value)}
          />
        </InspectorPropRow>
        <InspectorPropRow label={t("editor_project_fps")}>
          <select
            value={String(fps)}
            onChange={(event) =>
              onFpsChange?.(Number(event.target.value) as 24 | 25 | 30 | 60)
            }
            className="h-6 rounded border border-overlay-md bg-transparent px-2 text-xs text-dim-2 outline-none"
          >
            {[24, 25, 30, 60].map((value) => (
              <option
                key={value}
                value={value}
                className="bg-studio-surface text-dim-1"
              >
                {value} fps
              </option>
            ))}
          </select>
        </InspectorPropRow>
      </InspectorSection>

      <InspectorSection title={t("editor_project_section_thumbnail")}>
        <button
          onClick={onCaptureThumbnail}
          className="flex items-center gap-1.5 text-xs text-dim-2 bg-overlay-sm border border-overlay-sm px-3 py-1.5 rounded"
        >
          <Camera size={12} />
          {t("editor_set_thumbnail")}
        </button>
      </InspectorSection>
    </div>
  );
}
