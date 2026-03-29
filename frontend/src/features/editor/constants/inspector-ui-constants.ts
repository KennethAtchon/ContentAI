import type { Transition } from "../types/editor";

export const INSPECTOR_EFFECT_DEFINITIONS: {
  id: string;
  labelKey: string;
  contrast: number;
  warmth: number;
  opacity: number;
  swatchStyle: string;
}[] = [
  {
    id: "color-grade",
    labelKey: "editor_effect_color_grade",
    contrast: 20,
    warmth: 10,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)",
  },
  {
    id: "bw",
    labelKey: "editor_effect_bw",
    contrast: 10,
    warmth: -100,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #1a1a1a 0%, #888888 100%)",
  },
  {
    id: "warm",
    labelKey: "editor_effect_warm",
    warmth: 40,
    contrast: 5,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
  },
  {
    id: "cool",
    labelKey: "editor_effect_cool",
    warmth: -40,
    contrast: 5,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  },
  {
    id: "vignette",
    labelKey: "editor_effect_vignette",
    opacity: 0.9,
    contrast: 15,
    warmth: 0,
    swatchStyle: "radial-gradient(ellipse at center, #555 0%, #000 100%)",
  },
];

export const INSPECTOR_TRANSITION_OPTIONS: {
  value: Transition["type"];
  labelKey: string;
}[] = [
  { value: "none", labelKey: "editor_transitions_cut" },
  { value: "fade", labelKey: "editor_transitions_fade" },
  { value: "slide-left", labelKey: "editor_transitions_slide_left" },
  { value: "slide-up", labelKey: "editor_transitions_slide_up" },
  { value: "dissolve", labelKey: "editor_transitions_dissolve" },
  { value: "wipe-right", labelKey: "editor_transitions_wipe_right" },
];
