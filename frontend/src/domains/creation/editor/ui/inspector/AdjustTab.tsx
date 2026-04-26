import { useTranslation } from "react-i18next";
import type { Clip, ClipPatch, Transition } from "../../model/editor-domain";
import {
  InspectorPropRow,
  InspectorSliderRow,
  InspectorValuePill,
} from "./InspectorPropRow";
import { InspectorSection } from "./InspectorSection";

interface AdjustTabProps {
  selectedTransition: Transition | null;
  selectedClip: Clip | null;
  onEffectPreview?: (patch: ClipPatch | null) => void;
}

export function AdjustTab({
  selectedTransition,
  selectedClip,
  onEffectPreview,
}: AdjustTabProps) {
  const { t } = useTranslation();

  if (selectedTransition) {
    return (
      <div className="p-3">
        <InspectorSection title={t("editor_transitions_label")}>
          <InspectorPropRow label={t("editor_transitions_label")}>
            <InspectorValuePill value={selectedTransition.type} />
          </InspectorPropRow>
          <InspectorSliderRow
            label={t("editor_transitions_duration")}
            value={selectedTransition.durationMs}
            min={200}
            max={2000}
            step={100}
            onChange={() => undefined}
          />
        </InspectorSection>
      </div>
    );
  }

  return (
    <div className="p-3">
      <InspectorSection title={t("editor_inspector_tab_adjust")}>
        <InspectorSliderRow
          label={t("editor_opacity_label")}
          value={selectedClip ? selectedClip.opacity * 100 : 100}
          min={0}
          max={100}
          step={1}
          onChange={(value) => onEffectPreview?.({ opacity: value / 100 })}
        />
        <InspectorSliderRow
          label={t("editor_contrast_label")}
          value={selectedClip?.contrast ?? 0}
          min={-100}
          max={100}
          step={1}
          onChange={(value) => onEffectPreview?.({ contrast: value })}
        />
        <InspectorSliderRow
          label={t("editor_warmth_label")}
          value={selectedClip?.warmth ?? 0}
          min={-100}
          max={100}
          step={1}
          onChange={(value) => onEffectPreview?.({ warmth: value })}
        />
      </InspectorSection>
    </div>
  );
}
