import { InspectorPropRow, InspectorSection } from "../../components/inspector/InspectorPrimitives";
import type { TextPreset } from "../types";

interface Props {
  presets: TextPreset[];
  value: string;
  onChange: (presetId: string) => void;
}

export function CaptionPresetPicker({ presets, value, onChange }: Props) {
  return (
    <InspectorSection title="Caption Preset">
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
              <div className="text-xs font-medium text-dim-1">{preset.name}</div>
              <div className="text-[10px] text-dim-3">
                {preset.exportMode} export, {preset.groupingMs}ms grouping
              </div>
            </button>
          );
        })}
      </div>
      <InspectorPropRow label="Current">
        <span className="text-[10px] text-dim-3">{value}</span>
      </InspectorPropRow>
    </InspectorSection>
  );
}
