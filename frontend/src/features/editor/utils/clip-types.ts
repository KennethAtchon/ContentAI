import type {
  AudioClip,
  CaptionClip,
  Clip,
  MediaClip,
  MusicClip,
  TextClip,
  VideoClip,
} from "../types/editor";

export function isCaptionClip(clip: Clip): clip is CaptionClip {
  return clip.type === "caption";
}

export function isVideoClip(clip: Clip): clip is VideoClip {
  return clip.type === "video";
}

export function isAudioClip(clip: Clip): clip is AudioClip {
  return clip.type === "audio";
}

export function isMusicClip(clip: Clip): clip is MusicClip {
  return clip.type === "music";
}

export function isTextClip(clip: Clip): clip is TextClip {
  return clip.type === "text";
}

export function isMediaClip(clip: Clip): clip is MediaClip {
  return (
    clip.type === "video" || clip.type === "audio" || clip.type === "music"
  );
}

export function isNonCaptionClip(
  clip: Clip
): clip is Exclude<Clip, CaptionClip> {
  return clip.type !== "caption";
}
