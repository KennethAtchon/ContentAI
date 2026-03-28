import { cn } from "@/shared/utils/helpers/utils";
import type { CaptionPreset } from "../constants/caption-presets";

interface Props {
  preset: CaptionPreset;
  selected: boolean;
  onClick: () => void;
  /**
   * When true, reduces tile height from 64px to 48px.
   * Use in Inspector (tight vertical space). Default (false) for MediaPanel.
   */
  compact?: boolean;
}

const PREVIEW_WORDS = ["Your", "caption", "here"] as const;

// Always highlight the middle word to demonstrate animated presets
const ACTIVE_PREVIEW_INDEX = 1;

export function CaptionPresetTile({
  preset,
  selected,
  onClick,
  compact = false,
}: Props) {
  const displayWords = PREVIEW_WORDS.map((w) =>
    preset.textTransform === "uppercase" ? w.toUpperCase() : w
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded cursor-pointer border-0",
        "flex flex-col items-center justify-center",
        compact ? "h-12 px-2" : "h-16 px-3",
        selected
          ? "ring-2 ring-studio-accent"
          : "ring-1 ring-white/10 hover:ring-white/25",
        "transition-all"
      )}
    >
      {/* Dark gradient — simulates a video frame background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f23]" />

      {/* Caption word preview */}
      <div
        className="relative z-10 flex items-center justify-center flex-wrap"
        style={{
          fontFamily: preset.fontFamily,
          fontSize: compact ? 11 : 14,
          fontWeight: preset.fontWeight,
          gap: "0.3em",
        }}
      >
        {displayWords.map((word, i) => {
          const isActive =
            preset.animation !== "none" && i === ACTIVE_PREVIEW_INDEX;

          const textColor =
            isActive && preset.activeColor ? preset.activeColor : preset.color;

          // Lighten near-black text that would be invisible on the dark tile background
          const effectiveColor = textColor === "#111111" ? "#e5e7eb" : textColor;

          // Scale outline proportionally to the tile's small font size
          const outlineScale = compact ? 0.25 : 0.35;
          const outlineStyle =
            preset.outlineWidth > 0
              ? `${(preset.outlineWidth * outlineScale).toFixed(1)}px ${preset.outlineColor ?? "#000"}`
              : undefined;

          // Scale background padding proportionally from canvas pixels
          const backgroundPadding = preset.backgroundPadding
            ? `${Math.round(preset.backgroundPadding / 8)}px ${Math.round(preset.backgroundPadding / 4)}px`
            : undefined;

          return (
            <span
              key={i}
              style={{
                color: effectiveColor,
                WebkitTextStroke: outlineStyle,
                backgroundColor: preset.backgroundColor ?? undefined,
                padding: backgroundPadding,
                borderRadius: preset.backgroundRadius
                  ? preset.backgroundRadius / 2
                  : undefined,
                display: "inline",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Preset name label */}
      <span
        className={cn(
          "absolute bottom-0.5 left-0 right-0 text-center text-white/40 leading-none",
          compact ? "text-[7px]" : "text-[9px]"
        )}
      >
        {preset.name}
      </span>
    </button>
  );
}
