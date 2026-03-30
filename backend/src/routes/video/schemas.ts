import { z } from "zod";
import { MAX_SCRIPT_SHOT_DURATION_SECONDS } from "../../shared/constants/video-shot-durations";

export {
  timelineItemSchema,
  timelineSchema,
  type TimelinePayload,
} from "../../domain/video/video.schemas";

export const providerSchema = z.enum(["kling-fal", "runway", "image-ken-burns"]);
export const aspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const createReelSchema = z.object({
  generatedContentId: z.number().int().positive(),
  prompt: z.string().min(1).max(1000).optional(),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(MAX_SCRIPT_SHOT_DURATION_SECONDS)
    .optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});

export const regenerateShotSchema = z.object({
  generatedContentId: z.number().int().positive(),
  shotIndex: z.number().int().min(0).max(99),
  prompt: z.string().min(1).max(1000),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(MAX_SCRIPT_SHOT_DURATION_SECONDS)
    .optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});
