import { z } from "zod";

export const videoJobIdParamSchema = z.object({
  jobId: z.string().min(1),
});
