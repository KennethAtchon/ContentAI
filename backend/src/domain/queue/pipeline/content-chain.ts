import { and, desc, eq } from "drizzle-orm";
import { generatedContent } from "../../../infrastructure/database/drizzle/schema";
import { db } from "../../../services/db/db";

/**
 * Walk the parentId chain to find the latest descendant (chain tip).
 * Used to determine the correct next version number.
 */
export async function resolveChainTip(startId: number, userId: string) {
  const MAX_CHAIN_DEPTH = 50;
  const visitedIds = new Set<number>();
  let current = await db
    .select()
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, startId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!current) throw new Error("Content not found");

  visitedIds.add(current.id);
  let depth = 0;

  while (depth < MAX_CHAIN_DEPTH) {
    const [child] = await db
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.parentId, current.id),
          eq(generatedContent.userId, userId),
        ),
      )
      .orderBy(desc(generatedContent.createdAt))
      .limit(1);

    if (!child || visitedIds.has(child.id)) break;
    visitedIds.add(child.id);
    current = child;
    depth++;
  }

  return current;
}
