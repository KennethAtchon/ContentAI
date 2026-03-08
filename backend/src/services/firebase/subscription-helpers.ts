/**
 * Firestore Subscription Helpers
 *
 * Shared utilities for reading subscription data from Firestore documents
 * managed by the Firebase Stripe Extension. Previously these were inlined
 * identically in three admin subscription routes.
 */

/**
 * Extracts the subscription tier from a Firestore subscription document.
 *
 * The Firebase Stripe Extension stores tier info in two possible locations:
 * 1. `metadata.tier` — set by our own checkout flow
 * 2. `items.data[0].price.product.metadata.firebaseRole` — synced from Stripe product metadata
 *
 * Falls back to "basic" if neither is present.
 */
export function extractSubscriptionTier(subData: Record<string, any>): string {
  return (
    subData.metadata?.tier ||
    subData.items?.data?.[0]?.price?.product?.metadata?.firebaseRole ||
    "basic"
  );
}

/**
 * Converts a Firestore timestamp value to a JavaScript Date.
 *
 * Handles all timestamp formats that the Firebase Stripe Extension may store:
 * - Firestore Timestamp object (has `.toDate()`)
 * - Firestore Timestamp-like object (has `.seconds`)
 * - Native Date object
 * - Unix timestamp in seconds (< 1e12)
 * - Unix timestamp in milliseconds (>= 1e12)
 *
 * Returns null if the value is falsy or cannot be converted.
 */
export function convertFirestoreTimestamp(timestamp: unknown): Date | null {
  if (!timestamp) return null;

  if (
    typeof timestamp === "object" &&
    timestamp !== null &&
    "toDate" in timestamp &&
    typeof (timestamp as any).toDate === "function"
  ) {
    return (timestamp as any).toDate();
  }

  if (
    typeof timestamp === "object" &&
    timestamp !== null &&
    "seconds" in timestamp &&
    typeof (timestamp as any).seconds === "number"
  ) {
    return new Date((timestamp as any).seconds * 1000);
  }

  if (timestamp instanceof Date) {
    return timestamp;
  }

  if (typeof timestamp === "number") {
    // Timestamps in seconds are < 1e12 (~year 2001-2286 range)
    // Timestamps in milliseconds are >= 1e12
    return timestamp < 1e12 ? new Date(timestamp * 1000) : new Date(timestamp);
  }

  return null;
}
