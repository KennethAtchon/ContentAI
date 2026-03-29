import type { AppDb } from "../../database.types";
import { resolveGeneratedContentChainTip } from "../../content/content.repository";

/**
 * Walk the parentId chain to find the latest descendant (chain tip).
 * Used to determine the correct next version number.
 */
export async function resolveChainTip(
  startId: number,
  userId: string,
  database: AppDb,
) {
  return resolveGeneratedContentChainTip(database, startId, userId);
}
