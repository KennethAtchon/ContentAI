import type {
  AudioClip,
  CaptionClip,
  Clip,
  MediaClip,
  MusicClip,
  TextClip,
  TimelineClip,
  VideoClip,
} from "../types/editor";

export function isCaptionClip(clip: TimelineClip): clip is CaptionClip {
  return clip.type === "caption";
}

export function isVideoClip(clip: TimelineClip): clip is VideoClip {
  return clip.type === "video";
}

export function isAudioClip(clip: TimelineClip): clip is AudioClip {
  return clip.type === "audio";
}

export function isMusicClip(clip: TimelineClip): clip is MusicClip {
  return clip.type === "music";
}

export function isTextClip(clip: TimelineClip): clip is TextClip {
  return clip.type === "text";
}

export function isMediaClip(clip: TimelineClip): clip is MediaClip {
  return clip.type === "video" || clip.type === "audio" || clip.type === "music";
}

export function isNonCaptionClip(clip: TimelineClip): clip is Clip {
  return clip.type !== "caption";
}
