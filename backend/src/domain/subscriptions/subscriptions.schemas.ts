import { z } from "zod";

export const createCheckoutSessionBodySchema = z.object({
  priceId: z.string().trim().min(1),
  tier: z.string().trim().min(1).optional(),
  billingCycle: z.enum(["monthly", "annual"]).optional(),
  trialEnabled: z.boolean().optional().default(false),
});
