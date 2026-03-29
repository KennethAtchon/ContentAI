import { z } from "zod";

const outputTypes = ["hook_only", "caption_only", "full_script"] as const;

export const generateContentSchema = z.object({
  sourceReelId: z.coerce.number().int().positive(),
  prompt: z.string().trim().min(1).max(2000),
  outputType: z.enum(outputTypes).default("full_script"),
});

export const generationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const generationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const generationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const queueGeneratedContentSchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  instagramPageId: z.string().uuid().optional(),
});
