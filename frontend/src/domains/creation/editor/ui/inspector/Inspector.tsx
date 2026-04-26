import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorUIStore } from "../../store/editor-ui-store";
import { AdjustTab } from "./AdjustTab";
import { AnimateTab } from "./AnimateTab";
import { EffectsTab } from "./EffectsTab";
import { InspectorHeader, type InspectorTab } from "./InspectorHeader";
import { ProjectTab } from "./ProjectTab";

export function Inspector() {
  const { t } = useTranslation();
  const selectedClipId = useEditorUIStore((state) => state.selectedClipId);
  const tracks = useEditorProjectStore((state) => state.tracks);
  const durationMs = useEditorProjectStore((state) => state.durationMs);
  const resolution = useEditorProjectStore((state) => state.resolution);
  const fps = useEditorProjectStore((state) => state.fps);
  const setResolution = useEditorProjectStore((state) => state.setResolution);
  const setFps = useEditorProjectStore((state) => state.setFps);
  const updateClip = useEditorProjectStore((state) => state.updateClip);
  const [activeTab, setActiveTab] = useState<InspectorTab>("adjust");
  const selectedClip = selectedClipId
    ? tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId) ??
      null
    : null;
  const selectedTrack = selectedClipId
    ? tracks.find((track) => track.clips.some((clip) => clip.id === selectedClipId)) ??
      null
    : null;
  const clipCount = tracks.reduce(
    (count, track) => count + track.clips.length,
    0,
  );

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-overlay-sm bg-studio-surface"
      style={{ width: 320 }}
    >
      <InspectorHeader
        selectedTrack={selectedTrack}
        selectedClipLabel={selectedClip?.label ?? null}
        selectedTransition={null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {activeTab === "adjust" && selectedClip && (
          <AdjustTab
            selectedTransition={null}
            selectedClip={selectedClip}
            onEffectPreview={
              selectedClipId
                ? (patch) => {
                    if (patch) {
                      updateClip(selectedClipId, patch);
                    }
                  }
                : undefined
            }
          />
        )}
        {activeTab === "animate" && <AnimateTab />}
        {activeTab === "effects" && <EffectsTab />}
        {activeTab === "project" && (
          <ProjectTab
            durationMs={durationMs}
            clipCount={clipCount}
            resolution={resolution}
            fps={fps}
            onFpsChange={setFps as (fps: 24 | 25 | 30 | 60) => void}
            onResolutionChange={setResolution}
          />
        )}
        {activeTab === "adjust" && !selectedClip && (
          <p className="px-4 pb-4 text-xs italic text-dim-3">
            {t("editor_inspector_empty")}
          </p>
        )}
      </div>
    </div>
  );
}
