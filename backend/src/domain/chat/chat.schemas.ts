import { z } from "zod";
import { uuidProjectParam } from "../../validation/shared.schemas";

export const createSessionSchema = uuidProjectParam.extend({
  title: z.string().min(1).max(100).optional(),
});

export const listSessionsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  reelRefs: z.array(z.number()).optional(),
  mediaRefs: z.array(z.string()).optional(),
  activeContentId: z.number().optional(),
});

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  activeContentId: z.number().int().positive().nullable().optional(),
}).refine(
  (data) => data.title !== undefined || data.activeContentId !== undefined,
  { message: "At least one session field must be provided" },
);

export const resolveSessionForContentSchema = z.object({
  generatedContentId: z.number().int().positive(),
});
