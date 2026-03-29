import { z } from "zod";

/** Path / body object with a single UUID `id` (e.g. `/:id`). */
export const uuidParam = z.object({ id: z.string().uuid() });

/** Object with `projectId` as UUID (chat, projects). */
export const uuidProjectParam = z.object({ projectId: z.string().uuid() });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuery = z.object({
  q: z.string().min(1).optional(),
});
