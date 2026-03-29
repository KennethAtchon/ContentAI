import type { TrackType } from "../types/editor";

export const TRACK_HEIGHT = 56; // px per track
export const RULER_HEIGHT = 32; // px

/** Extra px past timeline end so the scroll area stays usable (playhead margin, drop room). */
export const TIMELINE_SCROLL_PADDING_PX = 4000;
/** Minimum scrollable width so short projects still have a workable ruler area. */
export const TIMELINE_MIN_CONTENT_WIDTH_PX = 4000;

export const ASSET_TYPE_TO_TRACK: Record<string, TrackType> = {
  video_clip: "video",
  assembled_video: "video",
  image: "video",
  voiceover: "audio",
  music: "music",
};
