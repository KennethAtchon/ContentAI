import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import type { Track, Transition } from "../../types/editor";
import { INSPECTOR_TRANSITION_OPTIONS } from "../../constants/inspector-ui-constants";
import {
  InspectorSection,
  InspectorPropRow,
  InspectorSliderRow,
} from "./InspectorPrimitives";

interface Props {
  tracks: Track[];
  selectedTransition: Transition;
  onSetTransition: (
    trackId: string,
    clipAId: string,
    clipBId: string,
    type: Transition["type"],
    durationMs: number
  ) => void;
  onRemoveTransition: (trackId: string, transitionId: string) => void;
}

export function InspectorTransitionPanel({
  tracks,
  selectedTransition,
  onSetTransition,
  onRemoveTransition,
}: Props) {
  const { t } = useTranslation();

  const transTrack = tracks.find((tr) =>
    (tr.transitions ?? []).some((x) => x.id === selectedTransition.id)
  );
  const clipA = transTrack?.clips.find(
    (c) => c.id === selectedTransition.clipAId
  );
  const clipB = transTrack?.clips.find(
    (c) => c.id === selectedTransition.clipBId
  );
  const maxDuration =
    clipA && clipB ? Math.min(clipA.durationMs, clipB.durationMs) - 100 : 2000;

  return (
    <InspectorSection title={t("editor_transitions_label")}>
      <InspectorPropRow label={t("editor_transitions_label")}>
        <select
          value={selectedTransition.type}
          onChange={(e) => {
            if (!transTrack) return;
            onSetTransition(
              transTrack.id,
              selectedTransition.clipAId,
              selectedTransition.clipBId,
              e.target.value as Transition["type"],
              selectedTransition.durationMs
            );
          }}
          className="text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border border-overlay-md"
        >
          {INSPECTOR_TRANSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </InspectorPropRow>

      {selectedTransition.type !== "none" && (
        <InspectorSliderRow
          label={t("editor_transitions_duration")}
          value={selectedTransition.durationMs}
          min={200}
          max={maxDuration}
          step={100}
          onChange={(val) => {
            if (!transTrack) return;
            onSetTransition(
              transTrack.id,
              selectedTransition.clipAId,
              selectedTransition.clipBId,
              selectedTransition.type,
              val
            );
          }}
        />
      )}

      {transTrack && selectedTransition.type !== "none" && (
        <button
          type="button"
          onClick={() =>
            onRemoveTransition(transTrack.id, selectedTransition.id)
          }
          className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer px-0"
        >
          <Trash2 size={11} />
          {t("editor_transitions_remove")}
        </button>
      )}
    </InspectorSection>
  );
}
