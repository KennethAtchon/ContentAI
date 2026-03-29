import { z } from "zod";

export const queueItemIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createQueueItemBodySchema = z.object({
  generatedContentId: z.coerce.number().int().positive(),
});

export const updateQueueItemBodySchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  instagramPageId: z.string().uuid().optional(),
  status: z
    .enum(["draft", "ready", "scheduled", "posted", "failed"])
    .optional(),
});

export const queueListQuerySchema = z.object({
  status: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sort: z.enum(["createdAt", "scheduledFor"]).optional().default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
