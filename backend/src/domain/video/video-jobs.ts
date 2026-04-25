/**
 * Domain entry for video job lifecycle operations.
 * Route and chat layers should import from here rather than the underlying
 * Redis-backed service implementation directly.
 */
export { videoJobService } from "../../services/video-generation/job.service";

export type {
  VideoJobKind,
  VideoJobProgress,
  VideoJobResult,
  VideoJobStatus,
  VideoRenderJob,
} from "../../services/video-generation/job.service";
