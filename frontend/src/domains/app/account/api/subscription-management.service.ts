import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import { CORE_FEATURE_API_PREFIX } from "@/shared/constants/app.constants";
import type { SubscriptionUsageStats } from "@contracts/subscription";

export function fetchSubscriptionUsage(): Promise<SubscriptionUsageStats> {
  return authenticatedFetchJson<SubscriptionUsageStats>(
    `${CORE_FEATURE_API_PREFIX}/usage`
  );
}
