import { useTranslation } from "react-i18next";
import { InspectorPropRow, InspectorSection } from "../../components/inspector/InspectorPrimitives";
import type { BackgroundLayer, FillLayer, StrokeLayer, TextPreset } from "../types";

function PresetSwatch({ preset }: { preset: TextPreset }) {
  const fill = preset.layers.find((l): l is FillLayer => l.type === "fill");
  const stroke = preset.layers.find((l): l is StrokeLayer => l.type === "stroke");
  const bg = preset.layers.find((l): l is BackgroundLayer => l.type === "background" && l.mode === "line");

  const color = fill?.color ?? "#FFFFFF";
  const fontSize = Math.max(10, Math.min(18, Math.round(preset.typography.fontSize / 4)));
  const fontWeight = preset.typography.fontWeight;
  const textShadow = stroke
    ? `0 0 ${stroke.width}px ${stroke.color}, 0 0 ${stroke.width}px ${stroke.color}`
    : "0 1px 3px rgba(0,0,0,0.8)";

  const bgStyle = bg
    ? { background: bg.color, padding: "1px 4px", borderRadius: 2 }
    : {};

  return (
    <div className="rounded px-2 py-1 text-center overflow-hidden bg-black/40" style={{ minHeight: 28 }}>
      <span
        style={{
          color,
          fontSize,
          fontWeight,
          textShadow,
          textTransform: preset.typography.textTransform === "uppercase" ? "uppercase" : undefined,
          letterSpacing: preset.typography.letterSpacing,
          ...bgStyle,
        }}
      >
        HELLO WORLD
      </span>
    </div>
  );
}

interface Props {
  presets: TextPreset[];
  value: string;
  onChange: (presetId: string) => void;
}

export function CaptionPresetPicker({ presets, value, onChange }: Props) {
  const { t } = useTranslation();
  const selectedPreset = presets.find((preset) => preset.id === value) ?? null;

  return (
    <InspectorSection title={t("editor_caption_preset_title")}>
      <div className="flex flex-col gap-1.5">
        {presets.map((preset) => {
          const active = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={[
                "w-full rounded border px-2 py-2 text-left transition-colors",
                active
                  ? "border-studio-accent bg-studio-accent/10"
                  : "border-overlay-sm bg-overlay-sm hover:border-overlay-md",
              ].join(" ")}
            >
              <PresetSwatch preset={preset} />
              <div className="mt-1 text-xs font-medium text-dim-1">{preset.name}</div>
              <div className="text-[10px] text-dim-3">
                {t(`editor_caption_export_mode_${preset.exportMode}`)},{" "}
                {t("editor_caption_grouping_value", { groupingMs: preset.groupingMs })}
              </div>
            </button>
          );
        })}
      </div>
      <InspectorPropRow label={t("editor_caption_current_label")}>
        <span className="text-[10px] text-dim-3">{value}</span>
      </InspectorPropRow>
      {selectedPreset && selectedPreset.exportMode !== "full" ? (
        <div className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
          {t("editor_caption_export_simplified_notice")}
        </div>
      ) : null}
    </InspectorSection>
  );
}
