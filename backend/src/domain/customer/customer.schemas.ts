import { z } from "zod";

export const updateCustomerSettingsSchema = z.object({
  preferredAiProvider: z
    .union([
      z.enum(["openai", "claude", "openrouter"]),
      z.literal("system_default"),
    ])
    .nullable()
    .optional(),
  preferredVideoProvider: z
    .union([
      z.enum(["kling-fal", "runway", "image-ken-burns"]),
      z.literal("system_default"),
    ])
    .nullable()
    .optional(),
  preferredVoiceId: z
    .union([z.string().max(100), z.literal("system_default")])
    .nullable()
    .optional(),
  preferredTtsSpeed: z
    .union([z.enum(["slow", "normal", "fast"]), z.literal("system_default")])
    .nullable()
    .optional(),
  preferredAspectRatio: z
    .union([z.enum(["9:16", "16:9", "1:1"]), z.literal("system_default")])
    .nullable()
    .optional(),
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(32).optional(),
  address: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(1).optional(),
});

export const createOrderFromCheckoutSchema = z.object({
  stripeSessionId: z.string().trim().min(1),
  status: z.string().trim().min(1).optional(),
});

export const createCustomerOrderSchema = z.object({
  totalAmount: z.coerce.number().positive().finite(),
  status: z.string().trim().min(1).optional(),
  stripeSessionId: z.string().trim().min(1).optional(),
  skipPayment: z.boolean().optional(),
  orderType: z.string().trim().min(1).optional(),
});

export const customerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const orderBySessionQuerySchema = z.object({
  sessionId: z.string().trim().min(1),
});

export const customerOrderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});
