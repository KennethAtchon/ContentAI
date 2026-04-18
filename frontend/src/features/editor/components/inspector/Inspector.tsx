import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClipPatch, Transition } from "../../types/editor";
import { useEditorContext } from "../../context/EditorContext";
import { InspectorHeader } from "./InspectorHeader";
import type { InspectorTab } from "./InspectorHeader";
import { AdjustTab } from "./AdjustTab";
import { AnimateTab } from "./AnimateTab";
import { EffectsTab } from "./EffectsTab";
import { ProjectTab } from "./ProjectTab";

interface Props {
  onEffectPreview?: (patch: ClipPatch | null) => void;
  selectedTransition: Transition | null;
  onFpsChange: (fps: 24 | 25 | 30 | 60) => void;
  onResolutionChange: (resolution: string) => void;
  isCapturingThumbnail: boolean;
  onCaptureThumbnail: () => void;
}

export function Inspector({
  onEffectPreview,
  selectedTransition,
  onFpsChange,
  onResolutionChange,
  isCapturingThumbnail,
  onCaptureThumbnail,
}: Props) {
  const { t } = useTranslation();
  const { selectedClip, selectedTrack } = useEditorContext();
  const [activeTab, setActiveTab] = useState<InspectorTab>("adjust");

  const hasSelection = !!selectedClip || !!selectedTransition;

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-overlay-sm bg-studio-surface"
      style={{ width: 320 }}
    >
      <InspectorHeader
        selectedTrack={selectedTrack}
        selectedClipLabel={"label" in (selectedClip ?? {}) ? (selectedClip as { label: string }).label : null}
        selectedTransition={selectedTransition}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {activeTab === "adjust" && (
          <>
            {!hasSelection ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
                <span className="text-4xl opacity-20">✦</span>
                <p className="text-xs italic text-dim-3 text-center">
                  {t("editor_inspector_empty")}
                </p>
              </div>
            ) : (
              <AdjustTab
                selectedTransition={selectedTransition}
                onEffectPreview={onEffectPreview}
              />
            )}
          </>
        )}

        {activeTab === "animate" && <AnimateTab />}
        {activeTab === "effects" && <EffectsTab />}

        {activeTab === "project" && (
          <ProjectTab
            onFpsChange={onFpsChange}
            onResolutionChange={onResolutionChange}
            isCapturingThumbnail={isCapturingThumbnail}
            onCaptureThumbnail={onCaptureThumbnail}
          />
        )}
      </div>
    </div>
  );
}
