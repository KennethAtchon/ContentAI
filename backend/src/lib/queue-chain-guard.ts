/**
 * Queue chain guard — prevents the "duplicate queue item per version" bug.
 *
 * Every content chain (v1 → v2 → v3 …) must have exactly ONE queue item.
 * When a new version is created the queue item's generatedContentId should be
 * updated to point at the new tip — never a second row inserted.
 *
 * Use `findChainQueueItem` before inserting to locate an existing item.
 * Use `assertNoChainQueueItem` at any raw insert site to blow up loudly if the
 * invariant is already violated so the call-stack is immediately visible.
 */

import { and, eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db as defaultDb } from "../services/db/db";
import {
  generatedContent,
  queueItems,
} from "../infrastructure/database/drizzle/schema";

type AnyDb = typeof defaultDb | PgTransaction<any, any, any>;

const MAX_WALK_DEPTH = 50;

export class QueueChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueChainError";
  }
}

/**
 * Walk UP the parent chain from `startContentId` and return the first queue
 * item found for any ancestor (including the start node itself).
 * Returns `null` if the chain has no queue item yet.
 */
export async function findChainQueueItem(
  db: AnyDb,
  startContentId: number,
  userId: string,
): Promise<{ queueItemId: number; atContentId: number } | null> {
  let currentId: number | null = startContentId;
  let depth = 0;

  while (currentId !== null && depth < MAX_WALK_DEPTH) {
    depth++;

    const [row] = await (db as typeof defaultDb)
      .select({
        id: generatedContent.id,
        parentId: generatedContent.parentId,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, currentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);

    if (!row) break;

    const [existing] = await (db as typeof defaultDb)
      .select({ id: queueItems.id })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.generatedContentId, currentId),
          eq(queueItems.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      return { queueItemId: existing.id, atContentId: currentId };
    }

    currentId = row.parentId ?? null;
  }

  return null;
}

/**
 * Throws a `QueueChainError` if any ancestor of `generatedContentId` already
 * has a queue item.  Call this immediately before any raw `INSERT INTO
 * queue_item` to get a loud, stack-traced error instead of a silent duplicate.
 *
 * @param label  Short human-readable caller name, e.g. "save_content" or
 *               "add_to_queue_endpoint" — shows up in the error message.
 */
export async function assertNoChainQueueItem(
  db: AnyDb,
  generatedContentId: number,
  userId: string,
  label: string,
): Promise<void> {
  const found = await findChainQueueItem(db, generatedContentId, userId);
  if (found) {
    throw new QueueChainError(
      `[QUEUE GUARD] [${label}] Blocked attempt to create a duplicate queue ` +
        `item for content chain containing id=${generatedContentId}. ` +
        `Ancestor content id=${found.atContentId} already owns queue item ` +
        `id=${found.queueItemId}. ` +
        `Update the existing queue item's generatedContentId instead of inserting a new row.`,
    );
  }
}
