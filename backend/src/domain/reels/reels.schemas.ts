import { z } from "zod";

export const bulkReelsSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1),
});

export const reelsListQuerySchema = z.object({
  nicheId: z.coerce.number().int().positive().optional(),
  niche: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  minViews: z.coerce.number().int().min(0).optional(),
  sort: z
    .enum(["views", "fresh", "engagement", "recent"])
    .optional()
    .default("views"),
  search: z.string().trim().min(1).optional(),
});

export const reelIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const reelsExportQuerySchema = z.object({
  nicheId: z.coerce.number().int().positive().optional(),
  niche: z.string().trim().optional(),
  format: z.enum(["json", "csv"]).optional().default("json"),
  minViews: z.coerce.number().int().min(0).optional(),
});
