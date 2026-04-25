import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdjustTab } from "./AdjustTab";
import { AnimateTab } from "./AnimateTab";
import { EffectsTab } from "./EffectsTab";
import { InspectorHeader, type InspectorTab } from "./InspectorHeader";
import { ProjectTab } from "./ProjectTab";

export function Inspector() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<InspectorTab>("adjust");

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-overlay-sm bg-studio-surface"
      style={{ width: 320 }}
    >
      <InspectorHeader
        selectedTrack={null}
        selectedClipLabel={null}
        selectedTransition={null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {activeTab === "adjust" && <AdjustTab selectedTransition={null} />}
        {activeTab === "animate" && <AnimateTab />}
        {activeTab === "effects" && <EffectsTab />}
        {activeTab === "project" && <ProjectTab />}
        {activeTab === "adjust" && (
          <p className="px-4 pb-4 text-xs italic text-dim-3">
            {t("editor_inspector_empty")}
          </p>
        )}
      </div>
    </div>
  );
}
