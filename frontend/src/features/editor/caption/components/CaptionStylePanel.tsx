import type { CaptionClip, CaptionStyleOverrides } from "../../types/editor";
import {
  InspectorSection,
  InspectorSliderRow,
  InspectorPropRow,
} from "../../components/inspector/InspectorPrimitives";

interface Props {
  clip: CaptionClip;
  onUpdateStyle: (payload: {
    overrides?: CaptionStyleOverrides;
    groupingMs?: number;
  }) => void;
}

export function CaptionStylePanel({ clip, onUpdateStyle }: Props) {
  return (
    <InspectorSection title="Caption Style">
      <InspectorSliderRow
        label="Grouping"
        value={clip.groupingMs}
        min={200}
        max={4000}
        step={100}
        onChange={(groupingMs) => onUpdateStyle({ groupingMs })}
      />
      <InspectorSliderRow
        label="Position Y"
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
        label="Font Size"
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
      <InspectorPropRow label="Text Case">
        <div className="flex gap-1">
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
                "rounded border px-2 py-0.5 text-[10px] capitalize",
                (clip.styleOverrides.textTransform ?? "none") === value
                  ? "border-studio-accent bg-studio-accent/10 text-studio-accent"
                  : "border-overlay-sm bg-overlay-sm text-dim-2",
              ].join(" ")}
            >
              {value}
            </button>
          ))}
        </div>
      </InspectorPropRow>
    </InspectorSection>
  );
}
