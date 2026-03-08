/**
 * Calculator Hook
 *
 * React hook for managing calculator state, performing calculations,
 * and tracking usage with subscription validation.
 */

// External packages
import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Features (domain logic)
import { useApp } from "@/shared/contexts/app-context";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import {
  CalculationType,
  MortgageInputs,
  LoanInputs,
  InvestmentInputs,
  RetirementInputs,
  CalculationResponse,
} from "../types/calculator.types";
import { hasFeatureAccess } from "@/shared/utils/permissions/core-feature-permissions";
import { CORE_FEATURE_API_PREFIX } from "@/shared/constants/app.constants";

// Shared (reusable code)
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { debugLog } from "@/shared/utils/debug";

interface UseCalculatorResult {
  calculate: (
    type: CalculationType,
    inputs: MortgageInputs | LoanInputs | InvestmentInputs | RetirementInputs
  ) => Promise<CalculationResponse | null>;
  isLoading: boolean;
  error: string | null;
  canUseCalculator: boolean;
  usageLimitReached: boolean;
  usageStats: {
    currentUsage: number;
    usageLimit: number | null;
    percentageUsed: number;
  } | null;
}

export function useCalculator(): UseCalculatorResult {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const fetcher = useQueryFetcher<{
    currentUsage: number;
    usageLimit: number | null;
    percentageUsed: number;
  }>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { role, isLoading: subscriptionLoading } = useSubscription();

  const {
    data: usageStatsData,
    error: usageStatsError,
    refetch: refetchUsageStats,
  } = useQuery({
    queryKey: queryKeys.api.calculatorUsage(),
    queryFn: () => fetcher(`${CORE_FEATURE_API_PREFIX}/usage`),
    enabled: !!user && !subscriptionLoading && !!role,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Extract usage stats from SWR response
  const usageStats = useMemo(() => {
    if (!usageStatsData) return null;
    return {
      currentUsage: usageStatsData.currentUsage,
      usageLimit: usageStatsData.usageLimit,
      percentageUsed: usageStatsData.percentageUsed,
    };
  }, [usageStatsData]);

  // Derive access state from usage stats (avoiding setState in effect)
  const { canUseCalculator, usageLimitReached } = useMemo(() => {
    if (!user || subscriptionLoading) {
      return { canUseCalculator: false, usageLimitReached: false };
    }

    if (!role) {
      return { canUseCalculator: false, usageLimitReached: false };
    }

    if (usageStatsError) {
      debugLog.error(
        "Error fetching calculator usage stats",
        {
          service: "use-calculator",
          operation: "fetchUsageStats",
        },
        usageStatsError
      );
      // Allow usage if stats check fails
      return { canUseCalculator: true, usageLimitReached: false };
    }

    if (usageStatsData) {
      const limitReached = usageStatsData.percentageUsed >= 100;
      return { canUseCalculator: true, usageLimitReached: limitReached };
    }

    return { canUseCalculator: false, usageLimitReached: false };
  }, [user, role, subscriptionLoading, usageStatsData, usageStatsError]);

  // Check access function for programmatic access checks
  const checkAccess = useCallback(async (): Promise<{
    canUse: boolean;
    limitReached: boolean;
  }> => {
    if (!user || subscriptionLoading) {
      return { canUse: false, limitReached: false };
    }

    if (!role) {
      return { canUse: false, limitReached: false };
    }

    // Revalidate usage stats to get latest data
    const { data: freshData } = await refetchUsageStats();

    if (freshData) {
      const limitReached = freshData.percentageUsed >= 100;
      return { canUse: true, limitReached };
    }

    return { canUse: true, limitReached: false };
  }, [user, role, subscriptionLoading, refetchUsageStats]);

  // Perform calculation
  const calculate = useCallback(
    async (
      type: CalculationType,
      inputs: MortgageInputs | LoanInputs | InvestmentInputs | RetirementInputs
    ): Promise<CalculationResponse | null> => {
      if (!user) {
        setError("You must be logged in to use the calculator");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Check calculator access using centralized permission system
        if (!hasFeatureAccess(role, type)) {
          if (!role) {
            setError("You need an active subscription to use this calculator");
            setIsLoading(false);
            return null;
          }

          setError(
            `This calculation type is not available in your ${role} plan. Please upgrade to access this feature.`
          );
          setIsLoading(false);
          return null;
        }

        // Check access and usage limits using checkAccess function
        const accessCheck = await checkAccess();
        if (!accessCheck.canUse) {
          setError("You do not have access to use the calculator");
          setIsLoading(false);
          return null;
        }

        if (accessCheck.limitReached && role) {
          setError(
            "You have reached your monthly calculation limit. Please upgrade your plan or wait for the next billing cycle."
          );
          setIsLoading(false);
          return null;
        }

        // Perform calculation via API (single source of truth)
        const result = await authenticatedFetchJson<CalculationResponse>(
          `${CORE_FEATURE_API_PREFIX}/calculate`,
          {
            method: "POST",
            body: JSON.stringify({
              type,
              inputs,
            }),
          }
        );

        if (!result) {
          setError("Failed to perform calculation");
          setIsLoading(false);
          return null;
        }

        // Invalidate React Query cache for usage stats and history after calculation
        queryClient.invalidateQueries({
          queryKey: queryKeys.api.calculatorUsage(),
        });
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === "api" &&
            q.queryKey[1] === "calculator" &&
            q.queryKey[2] === "history",
        });

        setIsLoading(false);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An error occurred during calculation";
        setError(errorMessage);
        setIsLoading(false);
        debugLog.error(
          "Error performing calculation",
          {
            service: "use-calculator",
            operation: "calculate",
          },
          err
        );
        return null;
      }
    },
    [user, role, checkAccess, queryClient]
  );

  return {
    calculate,
    isLoading,
    error,
    canUseCalculator,
    usageLimitReached,
    usageStats,
  };
}
