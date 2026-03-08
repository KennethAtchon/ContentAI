/**
 * Calculator Constants and Configuration
 *
 * Centralized configuration for all calculators in the system.
 * This is the SINGLE SOURCE OF TRUTH for calculator metadata, tier requirements,
 * and UI configuration.
 *
 * DESIGN PATTERN: Configuration-Driven Architecture
 * - All calculator definitions in one place
 * - Easy to add new calculators by adding to CALCULATOR_CONFIG
 * - Type-safe with TypeScript inference
 * - Used by both frontend and backend
 *
 * To add a new calculator:
 * 1. Add entry to CALCULATOR_CONFIG
 * 2. Add input/output types to calculator.types.ts
 * 3. Add validation schema to calculator-validation.ts
 * 4. Add calculation method to CalculatorService
 * 5. Add component to shared/components/calculator/
 */

import { SubscriptionTier } from "@/shared/constants/subscription.constants";
import { Home, CreditCard, TrendingUp, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Calculator Configuration
 *
 * Defines all calculators with their metadata, tier requirements, and UI configuration.
 * null tier requirement = free (not gated)
 */
export const CALCULATOR_CONFIG = {
  mortgage: {
    id: "mortgage" as const,
    name: "Mortgage Calculator",
    shortName: "Mortgage",
    description:
      "Calculate monthly mortgage payments and amortization schedules",
    longDescription:
      "Calculate monthly mortgage payments, total interest, and complete amortization schedules. Perfect for homebuyers and real estate professionals.",
    tierRequirement: null as SubscriptionTier | null, // FREE - no subscription required
    icon: Home,
    displayOrder: 1,
    features: [
      "Principal and interest calculations",
      "Property tax and insurance estimates",
      "Complete amortization schedules",
      "PMI calculations",
      "Refinancing analysis",
    ],
    availableIn: ["basic", "pro", "enterprise"] as const,
    mobileLabel: "Home",
  },
  loan: {
    id: "loan" as const,
    name: "Loan Calculator",
    shortName: "Loan",
    description: "Calculate loan payments and repayment schedules",
    longDescription:
      "Calculate loan payments, interest rates, and repayment schedules for personal loans, auto loans, and more.",
    tierRequirement: "basic" as SubscriptionTier,
    icon: CreditCard,
    displayOrder: 2,
    features: [
      "Fixed and variable rate calculations",
      "Payment amount optimization",
      "Interest rate analysis",
      "Loan term comparisons",
      "Early payoff calculations",
    ],
    availableIn: ["basic", "pro", "enterprise"] as const,
    mobileLabel: "Loan",
  },
  investment: {
    id: "investment" as const,
    name: "Investment Calculator",
    shortName: "Investment",
    description: "Plan investments with compound interest calculations",
    longDescription:
      "Plan your investments with compound interest calculations, growth projections, and portfolio analysis tools.",
    tierRequirement: "pro" as SubscriptionTier,
    icon: TrendingUp,
    displayOrder: 3,
    features: [
      "Compound interest calculations",
      "Future value projections",
      "Contribution planning",
      "ROI analysis",
      "Multiple investment scenarios",
    ],
    availableIn: ["pro", "enterprise"] as const,
    mobileLabel: "Invest",
  },
  retirement: {
    id: "retirement" as const,
    name: "Retirement Planner",
    shortName: "Retirement",
    description: "Plan for retirement with savings analysis and projections",
    longDescription:
      "Comprehensive retirement planning with savings analysis, income projections, and retirement readiness assessments.",
    tierRequirement: "enterprise" as SubscriptionTier,
    icon: Target,
    displayOrder: 4,
    features: [
      "Retirement savings goals",
      "Income projections",
      "Social Security estimates",
      "Withdrawal strategies",
      "Retirement readiness score",
    ],
    availableIn: ["enterprise"] as const,
    mobileLabel: "Retire",
  },
} as const;

/**
 * Type derived from calculator configuration
 * This ensures type safety and single source of truth
 */
export type CalculationType = keyof typeof CALCULATOR_CONFIG;

/**
 * Valid calculation types array (derived from config)
 */
export const VALID_CALCULATION_TYPES: readonly CalculationType[] = Object.keys(
  CALCULATOR_CONFIG
) as CalculationType[];

/**
 * Calculator tier requirements (derived from config)
 * Used by permission system
 */
export const CALCULATOR_TIER_REQUIREMENTS = Object.fromEntries(
  Object.entries(CALCULATOR_CONFIG).map(([key, config]) => [
    key,
    config.tierRequirement,
  ])
) as Record<CalculationType, SubscriptionTier | null>;

/**
 * Calculator metadata type
 */
export type CalculatorMetadata = (typeof CALCULATOR_CONFIG)[CalculationType];

/**
 * Get calculator configuration by type
 */
export function getCalculatorConfig(type: CalculationType): CalculatorMetadata {
  return CALCULATOR_CONFIG[type];
}

/**
 * Get all calculator configurations
 */
export function getAllCalculatorConfigs(): CalculatorMetadata[] {
  return Object.values(CALCULATOR_CONFIG).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

/**
 * Get calculator name by type
 */
export function getCalculatorName(type: CalculationType): string {
  return CALCULATOR_CONFIG[type].name;
}

/**
 * Get calculator short name by type
 */
export function getCalculatorShortName(type: CalculationType): string {
  const config = CALCULATOR_CONFIG[type];
  if (!config) {
    // Handle invalid calculation types gracefully
    // This can happen if the database has old calculation types
    // that no longer exist in the config
    return type || "Unknown";
  }
  return config.shortName;
}

/**
 * Get calculator description by type
 */
export function getCalculatorDescription(type: CalculationType): string {
  return CALCULATOR_CONFIG[type].description;
}

/**
 * Get calculator icon by type
 */
export function getCalculatorIcon(type: CalculationType): LucideIcon {
  return CALCULATOR_CONFIG[type].icon;
}

/**
 * Get calculator tier requirement by type
 */
export function getCalculatorTierRequirement(
  type: CalculationType
): SubscriptionTier | null {
  return CALCULATOR_CONFIG[type].tierRequirement;
}

/**
 * Get calculators available in a specific tier
 */
export function getCalculatorsForTier(
  tier: SubscriptionTier
): CalculationType[] {
  return (Object.keys(CALCULATOR_CONFIG) as CalculationType[]).filter(
    (type) => {
      const config = CALCULATOR_CONFIG[type];
      // Free calculators are available to all
      if (config.tierRequirement === null) {
        return true;
      }
      // Check if tier is in availableIn array
      // Use type assertion since we know tier is a valid SubscriptionTier
      return (config.availableIn as readonly SubscriptionTier[]).includes(tier);
    }
  );
}

/**
 * Check if a calculator is free (not gated)
 */
export function isCalculatorFree(type: CalculationType): boolean {
  return CALCULATOR_CONFIG[type].tierRequirement === null;
}
