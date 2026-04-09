import type { CaptionStyleOverrides } from "../types/editor";
import type { TextPreset } from "./types";

export function applyCaptionStyleOverrides(
  preset: TextPreset,
  overrides: CaptionStyleOverrides
): TextPreset {
  return {
    ...preset,
    typography: {
      ...preset.typography,
      fontSize: overrides.fontSize ?? preset.typography.fontSize,
      textTransform: overrides.textTransform ?? preset.typography.textTransform,
    },
    layout: {
      ...preset.layout,
      positionY: overrides.positionY ?? preset.layout.positionY,
    },
  };
}
