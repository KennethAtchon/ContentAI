import type {
  AudioClip,
  Clip,
  MediaClip,
  MusicClip,
  TextClip,
  VideoClip,
} from "../model/editor";

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
