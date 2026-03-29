import { z } from "zod";

export const patchAssetSchema = z.object({
  metadata: z.record(z.string(), z.unknown()),
});

export const assetIdParamSchema = z.object({
  id: z.string().min(1),
});

export const assetsListQuerySchema = z.object({
  generatedContentId: z.coerce.number().int().positive(),
  type: z.string().trim().optional(),
});
