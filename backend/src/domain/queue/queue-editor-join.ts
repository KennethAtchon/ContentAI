import { and, eq, isNull } from "drizzle-orm";
import {
  editProjects,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";

/**
 * `LEFT JOIN` condition: root edit project for the queue row’s `generated_content`
 * (same user, no parent snapshot row).
 */
export const rootEditProjectJoinQueueItems = and(
  eq(editProjects.generatedContentId, queueItems.generatedContentId),
  eq(editProjects.userId, queueItems.userId),
  isNull(editProjects.parentProjectId),
);
