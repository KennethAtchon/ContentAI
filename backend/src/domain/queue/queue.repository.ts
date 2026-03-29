import { and, eq, sql } from "drizzle-orm";
import { queueItems } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IQueueRepository {
  countScheduledByUserId(userId: string): Promise<number>;
}

export class QueueRepository implements IQueueRepository {
  constructor(private readonly db: AppDb) {}

  async countScheduledByUserId(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.userId, userId),
          eq(queueItems.status, "scheduled"),
        ),
      );
    return row?.count ?? 0;
  }
}
