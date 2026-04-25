import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { useApp } from "@/app/state/app-context";
import { useSubscription } from "@/domains/subscriptions/hooks/use-subscription";
import { getTierConfig } from "@/shared/constants/subscription.constants";
import { fetchSubscriptionUsage } from "../api/subscription-management.service";

export function useSubscriptionManagement() {
  const { user } = useApp();
  const {
    role,
    hasEnterpriseAccess,
    isLoading: subscriptionLoading,
  } = useSubscription();

  const {
    data: usageStats,
    error,
    isLoading: usageLoading,
  } = useQuery({
    queryKey: queryKeys.api.reelsUsage(),
    queryFn: fetchSubscriptionUsage,
    enabled: !!user,
  });

  return {
    error,
    hasEnterpriseAccess,
    loading: usageLoading || subscriptionLoading,
    role,
    tierConfig: role ? getTierConfig(role) : null,
    usageStats,
  };
}
