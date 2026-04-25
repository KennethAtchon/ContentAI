/**
 * Subscription Tier Type Guards
 *
 * Type-safe utilities for validating and narrowing SubscriptionTier types.
 * Prevents unsafe type assertions and provides runtime validation.
 */

import {
  SUBSCRIPTION_TIERS,
  SubscriptionTier,
} from "@/shared/constants/subscription.constants";

/**
 * Type guard to check if a value is a valid SubscriptionTier
 *
 * @param value - The value to check
 * @returns True if value is a valid SubscriptionTier, false otherwise
 */
export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  if (typeof value !== "string") {
    return false;
  }

  return Object.values(SUBSCRIPTION_TIERS).includes(value as SubscriptionTier);
}

/**
 * Safely narrows a value to SubscriptionTier or returns null
 *
 * @param value - The value to narrow
 * @returns SubscriptionTier if valid, null otherwise
 */
export function toSubscriptionTier(value: unknown): SubscriptionTier | null {
  return isSubscriptionTier(value) ? value : null;
}

/**
 * Validates and narrows a value to SubscriptionTier, throwing if invalid
 *
 * @param value - The value to validate
 * @param context - Context for error message
 * @returns SubscriptionTier
 * @throws Error if value is not a valid SubscriptionTier
 */
export function assertSubscriptionTier(
  value: unknown,
  context = "subscription tier validation"
): SubscriptionTier {
  if (!isSubscriptionTier(value)) {
    throw new Error(
      `Invalid ${context}: expected one of ${Object.values(SUBSCRIPTION_TIERS).join(", ")}, got ${typeof value === "string" ? value : String(value)}`
    );
  }
  return value;
}
