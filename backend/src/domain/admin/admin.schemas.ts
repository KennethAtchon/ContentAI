import { z } from "zod";

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  customerId: z.string().uuid().optional(),
});

export const adminCreateOrderBodySchema = z.object({
  userId: z.string().uuid(),
  totalAmount: z.union([z.number(), z.string().trim().min(1)]),
  status: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "completed",
      "cancelled",
      "refunded",
    ])
    .optional(),
});

export const adminUpdateOrderBodySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  totalAmount: z.union([z.number(), z.string().trim().min(1)]).optional(),
  status: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "completed",
      "cancelled",
      "refunded",
    ])
    .optional(),
});

export const adminDeleteOrderBodySchema = z.object({
  id: z.string().uuid(),
  deletedBy: z.string().trim().min(1).max(255).optional(),
});

export const adminOrderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const adminVerifyBodySchema = z.object({
  adminCode: z.string().trim().min(1),
});

export const adminConfigUpdateBodySchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
});

export const adminConfigInvalidateBodySchema = z.object({
  category: z.string().trim().min(1).optional().default("all"),
});

export const adminCreateNicheBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional().default(true),
});

export const adminUpdateNicheBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const adminScanNicheBodySchema = z.object({
  limit: z.number().int().min(1).max(10000).optional(),
  minViews: z.number().int().min(0).optional(),
  maxDaysOld: z.number().int().min(1).max(365).optional(),
  viralOnly: z.boolean().optional(),
});

export const adminUpdateNicheConfigBodySchema = z.object({
  scrapeLimit: z.number().int().min(1).max(10000).optional(),
  scrapeMinViews: z.number().int().min(0).optional(),
  scrapeMaxDaysOld: z.number().int().min(1).max(365).optional(),
  scrapeIncludeViralOnly: z.boolean().optional(),
});

export const adminNichesQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  active: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional()
    .default(false),
});

export const adminNicheIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const adminReelIdParamSchema = z.object({
  reelId: z.coerce.number().int().positive(),
});

export const adminJobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const adminNicheReelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(["views", "likes", "engagement", "postedAt", "scrapedAt"]).optional().default("views"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  viral: z.enum(["true", "false"]).optional(),
  hasVideo: z.enum(["true"]).optional(),
});

export const adminFeatureUsagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(1).optional(),
});

export const adminSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.string().trim().optional(),
  tier: z.string().trim().optional(),
  search: z.string().trim().min(1).optional(),
});

export const adminCostsByUserQuerySchema = z.object({
  period: z.string().trim().optional().default("30d"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminCostsQuerySchema = z.object({
  period: z.string().trim().optional().default("30d"),
});

export const adminSubscriptionIdParamSchema = z.object({
  id: z.string().min(1),
});

export const adminMusicQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
});

export const adminMusicIdParamSchema = z.object({
  id: z.string().min(1),
});

export const platformMusicMoodSchema = z.enum([
  "energetic",
  "calm",
  "dramatic",
  "funny",
  "inspiring",
]);

export const adminPatchMusicTrackBodySchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).optional(),
  artistName: z.string().nullable().optional(),
  mood: platformMusicMoodSchema.optional(),
  genre: z.string().nullable().optional(),
});

export const adminSystemExportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  includeDeleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional()
    .default(false),
});

export const adminSystemExportNameParamSchema = z.object({
  exportName: z.string().min(1),
});

export const adminConfigCategoryParamSchema = z.object({
  category: z.string().min(1),
});

export const adminConfigKeyParamSchema = z.object({
  category: z.string().min(1),
  key: z.string().min(1),
});
