import { useTranslation } from "react-i18next";
import type { CaptionClip, CaptionStyleOverrides } from "../../model/editor";
import {
  InspectorSection,
  InspectorSliderRow,
  InspectorPropRow,
} from "../inspector/InspectorPrimitives";

interface Props {
  clip: CaptionClip;
  onUpdateStyle: (payload: {
    overrides?: CaptionStyleOverrides;
    groupingMs?: number;
  }) => void;
}

export function CaptionStylePanel({ clip, onUpdateStyle }: Props) {
  const { t } = useTranslation();

  return (
    <InspectorSection title={t("editor_caption_style_title")}>
      <InspectorSliderRow
        label={t("editor_caption_grouping_label")}
        value={clip.groupingMs}
        min={200}
        max={4000}
        step={100}
        onChange={(groupingMs) => onUpdateStyle({ groupingMs })}
      />
      <InspectorSliderRow
        label={t("editor_caption_position_y_label")}
        value={clip.styleOverrides.positionY ?? 80}
        min={0}
        max={100}
        step={1}
        onChange={(positionY) =>
          onUpdateStyle({
            overrides: { ...clip.styleOverrides, positionY },
          })
        }
      />
      <InspectorSliderRow
        label={t("editor_caption_font_size_label")}
        value={clip.styleOverrides.fontSize ?? 56}
        min={16}
        max={120}
        step={2}
        onChange={(fontSize) =>
          onUpdateStyle({
            overrides: { ...clip.styleOverrides, fontSize },
          })
        }
      />
      <InspectorPropRow label={t("editor_caption_text_case_label")}>
        <div className="flex flex-wrap justify-end gap-1">
          {(["none", "uppercase", "lowercase"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onUpdateStyle({
                  overrides: { ...clip.styleOverrides, textTransform: value },
                })
              }
              className={[
                "rounded border px-1.5 py-0.5 text-[10px] capitalize",
                (clip.styleOverrides.textTransform ?? "none") === value
                  ? "border-studio-accent bg-studio-accent/10 text-studio-accent"
                  : "border-overlay-sm bg-overlay-sm text-dim-2",
              ].join(" ")}
            >
              {t(`editor_caption_text_case_${value}`)}
            </button>
          ))}
        </div>
      </InspectorPropRow>
    </InspectorSection>
  );
}
