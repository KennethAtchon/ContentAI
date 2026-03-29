import { useTranslation } from "react-i18next";
import { Switch } from "@/shared/components/ui/switch";
import type { Clip, TrackType } from "../../types/editor";
import { INSPECTOR_EFFECT_DEFINITIONS } from "../../constants/inspector-ui-constants";
import {
  InspectorSection,
  InspectorPropRow,
  InspectorSliderRow,
} from "./InspectorPrimitives";

interface Props {
  clip: Clip;
  trackType: TrackType | undefined;
  isMediaClip: boolean;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  onEffectPreview?: (patch: Partial<Clip> | null) => void;
}

export function InspectorClipVisualPanel({
  clip,
  trackType,
  isMediaClip,
  onUpdateClip,
  onEffectPreview,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <InspectorSection title={t("inspector_section_look")}>
        <InspectorSliderRow
          label={t("inspector_prop_opacity")}
          value={clip.opacity ?? 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onUpdateClip(clip.id, { opacity: v })}
        />
        <InspectorSliderRow
          label={t("inspector_prop_warmth")}
          value={clip.warmth ?? 0}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => onUpdateClip(clip.id, { warmth: v })}
        />
        <InspectorSliderRow
          label={t("inspector_prop_contrast")}
          value={clip.contrast ?? 0}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => onUpdateClip(clip.id, { contrast: v })}
        />
      </InspectorSection>

      {trackType === "video" && (
        <InspectorSection title={t("editor_effects_tab")}>
          <div className="flex gap-1.5 flex-wrap">
            {INSPECTOR_EFFECT_DEFINITIONS.map((effect) => (
              <button
                key={effect.id}
                type="button"
                title={t(effect.labelKey)}
                onClick={() =>
                  onUpdateClip(clip.id, {
                    contrast: effect.contrast ?? 0,
                    warmth: effect.warmth ?? 0,
                    opacity: effect.opacity ?? 1,
                  })
                }
                onMouseEnter={() =>
                  onEffectPreview?.({
                    contrast: effect.contrast ?? 0,
                    warmth: effect.warmth ?? 0,
                    opacity: effect.opacity ?? 1,
                  })
                }
                onMouseLeave={() => onEffectPreview?.(null)}
                className="w-10 h-10 rounded border border-overlay-md hover:border-studio-accent/60 cursor-pointer transition-all hover:scale-105 border-0 p-0 overflow-hidden shrink-0"
                style={{ background: effect.swatchStyle }}
              />
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title={t("inspector_section_transform")}>
        <InspectorPropRow label={t("inspector_prop_x")}>
          <input
            type="number"
            className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
            value={clip.positionX ?? 0}
            onChange={(e) =>
              onUpdateClip(clip.id, { positionX: Number(e.target.value) })
            }
          />
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_y")}>
          <input
            type="number"
            className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
            value={clip.positionY ?? 0}
            onChange={(e) =>
              onUpdateClip(clip.id, { positionY: Number(e.target.value) })
            }
          />
        </InspectorPropRow>
        <InspectorSliderRow
          label={t("inspector_prop_scale")}
          value={clip.scale ?? 1}
          min={0.1}
          max={3}
          step={0.05}
          onChange={(v) => onUpdateClip(clip.id, { scale: v })}
        />
        <InspectorSliderRow
          label={t("inspector_prop_rotation")}
          value={clip.rotation ?? 0}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => onUpdateClip(clip.id, { rotation: v })}
        />
      </InspectorSection>

      {isMediaClip && (
        <InspectorSection title={t("inspector_section_sound")}>
          <InspectorSliderRow
            label={t("inspector_prop_volume")}
            value={clip.volume ?? 1}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => onUpdateClip(clip.id, { volume: v })}
          />
          <InspectorPropRow label={t("inspector_prop_mute")}>
            <Switch
              checked={clip.muted ?? false}
              onCheckedChange={(checked) => onUpdateClip(clip.id, { muted: checked })}
            />
          </InspectorPropRow>
        </InspectorSection>
      )}
    </>
  );
}
