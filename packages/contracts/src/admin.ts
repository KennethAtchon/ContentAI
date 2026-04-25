import { z } from "zod";

export const adminOrderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "completed",
  "cancelled",
  "refunded",
]);

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  customerId: z.string().uuid().optional(),
});

export const adminCreateOrderBodySchema = z.object({
  userId: z.string().uuid(),
  totalAmount: z.union([z.number(), z.string().trim().min(1)]),
  status: adminOrderStatusSchema.optional(),
});

export const adminUpdateOrderBodySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  totalAmount: z.union([z.number(), z.string().trim().min(1)]).optional(),
  status: adminOrderStatusSchema.optional(),
});

export const adminOrderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AdminOrderStatus = z.infer<typeof adminOrderStatusSchema>;
