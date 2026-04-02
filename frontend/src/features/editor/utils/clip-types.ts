import type { CaptionClip, Clip, TimelineClip } from "../types/editor";

export function isCaptionClip(clip: TimelineClip): clip is CaptionClip {
  return "type" in clip && clip.type === "caption";
}

export function isMediaClip(clip: TimelineClip): clip is Clip {
  return "assetId" in clip;
}

export function isTextContentClip(clip: TimelineClip): clip is Clip {
  return "textContent" in clip;
}
