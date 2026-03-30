/**
 * Domain entry for video clip generation — delegates to infrastructure adapters.
 * Routes and chat tools should import from here rather than `services/video-generation` directly.
 */
export {
  generateVideoClip,
  getVideoGenerationProvider,
} from "../../services/video-generation";

export type {
  GenerateVideoClipParams,
  VideoClipResult,
  VideoClipResultProvider,
  VideoGenerationProvider,
  VideoProvider,
} from "../../services/video-generation";
