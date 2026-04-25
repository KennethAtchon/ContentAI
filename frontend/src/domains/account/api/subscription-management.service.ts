import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import { CORE_FEATURE_API_PREFIX } from "@/shared/constants/app.constants";

export interface SubscriptionUsageStats {
  currentUsage: number;
  usageLimit: number | null;
  percentageUsed: number;
  limitReached?: boolean;
  resetDate?: string;
}

export function fetchSubscriptionUsage(): Promise<SubscriptionUsageStats> {
  return authenticatedFetchJson<SubscriptionUsageStats>(
    `${CORE_FEATURE_API_PREFIX}/usage`,
  );
}
