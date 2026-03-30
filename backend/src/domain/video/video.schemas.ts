import { z } from "zod";

export const videoJobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const timelineItemSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).optional(),
  lane: z.number().int().min(0).optional(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(1).optional(),
  role: z.string().optional(),
  transitionIn: z
    .object({
      type: z.enum(["cut", "crossfade", "swipe", "fade"]),
      durationMs: z.number().int().min(0).max(2000),
    })
    .optional(),
  transitionOut: z
    .object({
      type: z.enum(["cut", "crossfade", "swipe", "fade"]),
      durationMs: z.number().int().min(0).max(2000),
    })
    .optional(),
});

/** Timeline shape used by video validation / assembly helpers. */
export const timelineSchema = z.object({
  schemaVersion: z.number().int().default(1),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().int().min(1),
  tracks: z.object({
    video: z.array(timelineItemSchema).default([]),
    audio: z.array(timelineItemSchema).default([]),
    text: z.array(z.record(z.string(), z.unknown())).default([]),
    captions: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

export type TimelinePayload = z.infer<typeof timelineSchema>;
export type TimelineItemPayload = z.infer<typeof timelineItemSchema>;
