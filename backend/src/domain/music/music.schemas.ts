import { z } from "zod";

export const musicListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  mood: z.string().trim().min(1).optional(),
  durationBucket: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const musicAttachBodySchema = z.object({
  generatedContentId: z.number().int().positive(),
  musicTrackId: z.string(),
});
