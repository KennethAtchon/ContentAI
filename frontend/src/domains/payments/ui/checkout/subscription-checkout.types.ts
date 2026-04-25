import type { SubscriptionTierConfig } from "@/shared/constants/subscription.constants";

export interface SubscriptionSummaryProps {
  tierConfig: SubscriptionTierConfig;
  billingCycle: "monthly" | "annual";
  showTrial: boolean;
  annualSavings: number;
  savingsPercentage: number;
  isProcessing: boolean;
  onCheckout: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}
