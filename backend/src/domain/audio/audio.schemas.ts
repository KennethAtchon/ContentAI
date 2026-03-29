import { z } from "zod";

export const audioListQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  nicheId: z.coerce.number().int().positive().optional(),
});
