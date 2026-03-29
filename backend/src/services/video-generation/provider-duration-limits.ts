import {
  MAX_SCRIPT_SHOT_DURATION_SECONDS,
  MIN_SCRIPT_SHOT_DURATION_SECONDS,
} from "@/shared/constants/video-shot-durations";

/**
 * Ken Burns / FFmpeg path: we control output length; allow full product range.
 */
export const KEN_BURNS_DURATION_MIN = MIN_SCRIPT_SHOT_DURATION_SECONDS;
export const KEN_BURNS_DURATION_MAX = MAX_SCRIPT_SHOT_DURATION_SECONDS;

/**
 * Third-party text-to-video APIs only accept a short range; we still store the
 * real output length from the downloaded MP4.
 */
export const KLING_API_DURATION_MIN = 3;
export const KLING_API_DURATION_MAX = 10;

export const RUNWAY_API_DURATION_MIN = 3;
export const RUNWAY_API_DURATION_MAX = 10;
