import { z } from "zod";

export const contactMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

const lineItemSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  price: z.string().trim().min(1),
});

export const sendOrderConfirmationEmailSchema = z.object({
  customerName: z.string().trim().min(1),
  customerEmail: z.string().trim().email(),
  orderId: z.string().trim().min(1),
  therapies: z.array(lineItemSchema).optional().default([]),
  products: z.array(lineItemSchema).optional().default([]),
  totalAmount: z.string().trim().min(1),
  address: z.string().trim().min(1),
  phone: z.string().trim().min(1).optional(),
});
