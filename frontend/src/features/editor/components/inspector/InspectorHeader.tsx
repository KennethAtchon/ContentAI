import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import type { Track, Transition } from "../../types/editor";

export type InspectorTab = "adjust" | "animate" | "effects" | "project";

const TRACK_TYPE_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  video: { label: "VIDEO", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  audio: { label: "AUDIO", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  music: { label: "MUSIC", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  text: { label: "TEXT", className: "bg-green-500/20 text-green-400 border-green-500/30" },
};

interface InspectorHeaderProps {
  selectedTrack: Track | null;
  selectedClipLabel: string | null;
  selectedTransition: Transition | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
}

export function InspectorHeader({
  selectedTrack,
  selectedClipLabel,
  selectedTransition,
  activeTab,
  onTabChange,
}: InspectorHeaderProps) {
  const { t } = useTranslation();

  const badge = selectedTransition
    ? { label: "TRANSITION", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" }
    : selectedTrack
      ? TRACK_TYPE_BADGE[selectedTrack.type] ?? { label: selectedTrack.type.toUpperCase(), className: "bg-overlay-md text-dim-2 border-overlay-md" }
      : null;

  const TABS: { key: InspectorTab; label: string }[] = [
    { key: "adjust", label: t("editor_inspector_tab_adjust") },
    { key: "animate", label: t("editor_inspector_tab_animate") },
    { key: "effects", label: t("editor_inspector_tab_effects") },
    { key: "project", label: t("editor_inspector_tab_project") },
  ];

  return (
    <div className="shrink-0 border-b border-overlay-sm">
      {badge && (
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
              badge.className
            )}
          >
            {badge.label}
          </span>
          {selectedClipLabel && (
            <span className="text-xs text-dim-2 truncate">{selectedClipLabel}</span>
          )}
        </div>
      )}
      <div className="flex border-b border-overlay-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-medium border-0 cursor-pointer transition-colors bg-transparent border-b-2",
              activeTab === tab.key
                ? "text-studio-accent border-b-studio-accent"
                : "text-dim-3 border-b-transparent hover:text-dim-1"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
