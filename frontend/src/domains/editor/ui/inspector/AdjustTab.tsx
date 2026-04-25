import { useTranslation } from "react-i18next";
import type { ClipPatch, Transition } from "../../model/editor";
import {
  InspectorPropRow,
  InspectorSliderRow,
  InspectorValuePill,
} from "./InspectorPropRow";
import { InspectorSection } from "./InspectorSection";

interface AdjustTabProps {
  selectedTransition: Transition | null;
  onEffectPreview?: (patch: ClipPatch | null) => void;
}

export function AdjustTab({
  selectedTransition,
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
          value={100}
          min={0}
          max={100}
          step={1}
          onChange={() => onEffectPreview?.({ opacity: 1 })}
        />
        <InspectorSliderRow
          label={t("editor_contrast_label")}
          value={0}
          min={-100}
          max={100}
          step={1}
          onChange={() => onEffectPreview?.({ contrast: 0 })}
        />
        <InspectorSliderRow
          label={t("editor_warmth_label")}
          value={0}
          min={-100}
          max={100}
          step={1}
          onChange={() => onEffectPreview?.({ warmth: 0 })}
        />
      </InspectorSection>
    </div>
  );
}
