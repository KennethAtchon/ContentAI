import { z } from "zod";

export const audioListQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  nicheId: z.coerce.number().int().positive().optional(),
});

export const audioTtsBodySchema = z.object({
  generatedContentId: z.number().int().positive(),
  text: z.string().min(1).max(5000),
  voiceId: z.string(),
  speed: z.enum(["slow", "normal", "fast"]),
});
