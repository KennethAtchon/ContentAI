import { z } from "zod";

export const usersListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
  includeDeleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) =>
      typeof value === "boolean" ? value : value === "true",
    )
    .optional()
    .default(false),
});

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128).optional(),
  createInFirebase: z.boolean().optional().default(false),
  timezone: z.string().trim().min(1).optional().default("UTC"),
});

export const updateUserBodySchema = z.object({
  id: z.string().uuid(),
  phone: z.string().trim().max(32).optional(),
  address: z.string().trim().max(500).optional(),
  role: z.enum(["user", "admin"]).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(8).max(128).optional(),
  email: z.string().trim().email().max(255).optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().trim().min(1).optional(),
});

export const deleteUserBodySchema = z.object({
  id: z.string().uuid(),
  hardDelete: z.boolean().optional().default(false),
});

export const objectToProcessingBodySchema = z.object({
  userId: z.string().uuid(),
});
