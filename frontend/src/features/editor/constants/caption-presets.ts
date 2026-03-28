export interface CaptionPreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textTransform: "none" | "uppercase";
  color: string;
  activeColor?: string;
  outlineColor?: string;
  outlineWidth: number;
  backgroundColor?: string;
  backgroundRadius?: number;
  backgroundPadding?: number;
  positionY: number;
  animation: "none" | "highlight" | "karaoke";
  groupSize: number;
}

export const CAPTION_PRESETS: readonly CaptionPreset[] = [
  {
    id: "hormozi",
    name: "Hormozi",
    fontFamily: "Inter",
    fontSize: 56,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#FFFFFF",
    activeColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 2,
    positionY: 80,
    animation: "highlight",
    groupSize: 3,
  },
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    fontFamily: "Inter",
    fontSize: 44,
    fontWeight: "700",
    textTransform: "none",
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 1,
    positionY: 80,
    animation: "none",
    groupSize: 4,
  },
  {
    id: "dark-box",
    name: "Dark Box",
    fontFamily: "Inter",
    fontSize: 44,
    fontWeight: "700",
    textTransform: "none",
    color: "#FFFFFF",
    outlineWidth: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    backgroundRadius: 8,
    backgroundPadding: 12,
    positionY: 80,
    animation: "none",
    groupSize: 3,
  },
  {
    id: "karaoke",
    name: "Karaoke",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: "700",
    textTransform: "none",
    color: "rgba(255,255,255,0.4)",
    activeColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 2,
    positionY: 80,
    animation: "karaoke",
    groupSize: 5,
  },
  {
    id: "bold-outline",
    name: "Bold Outline",
    fontFamily: "Inter",
    fontSize: 56,
    fontWeight: "900",
    textTransform: "none",
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 3,
    positionY: 80,
    animation: "none",
    groupSize: 3,
  },
] as const;

/**
 * Maps preset IDs from before the 2026-03 style theme overhaul to their
 * current equivalents. Used by getCaptionPreset() so that projects saved
 * with old IDs continue to render correctly.
 *
 * DO NOT remove entries. Add new entries when IDs are renamed or removed.
 */
const LEGACY_ID_MAP: Readonly<Record<string, string>> = {
  "clean-white": "clean-minimal",
  "box-dark": "dark-box",
  "box-accent": "dark-box",
  "highlight": "hormozi",
};

/**
 * Resolve a preset ID (including legacy IDs) to a CaptionPreset.
 *
 * Resolution order:
 * 1. If id is in LEGACY_ID_MAP, resolve to the mapped ID.
 * 2. Find the resolved ID in CAPTION_PRESETS.
 * 3. If still not found, fall back to CAPTION_PRESETS[0] (Hormozi).
 */
export function getCaptionPreset(id: string): CaptionPreset {
  const resolvedId = LEGACY_ID_MAP[id] ?? id;
  return CAPTION_PRESETS.find((p) => p.id === resolvedId) ?? CAPTION_PRESETS[0];
}
