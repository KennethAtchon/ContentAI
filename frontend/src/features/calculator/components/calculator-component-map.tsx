/**
 * Calculator Component Mapping
 *
 * Maps calculator types to their React components.
 * This allows dynamic rendering based on calculator configuration.
 * Uses dynamic imports for code splitting and performance optimization.
 */

import { lazy, ComponentType } from "react";
import type { CalculationType } from "../types/calculator.types";

// Dynamic imports with loading states for better performance
const MortgageCalculator = lazy(() =>
  import("@/features/calculator/components/mortgage-calculator").then(
    (mod) => ({
      default: mod.MortgageCalculator,
    })
  )
);

const LoanCalculator = lazy(() =>
  import("@/features/calculator/components/loan-calculator").then((mod) => ({
    default: mod.LoanCalculator,
  }))
);

const InvestmentCalculator = lazy(() =>
  import("@/features/calculator/components/investment-calculator").then(
    (mod) => ({
      default: mod.InvestmentCalculator,
    })
  )
);

const RetirementCalculator = lazy(() =>
  import("@/features/calculator/components/retirement-calculator").then(
    (mod) => ({
      default: mod.RetirementCalculator,
    })
  )
);

/**
 * Map of calculator types to their components
 * Add new calculators here when adding to CALCULATOR_CONFIG
 */
export const CALCULATOR_COMPONENT_MAP: Record<CalculationType, ComponentType> =
  {
    mortgage: MortgageCalculator,
    loan: LoanCalculator,
    investment: InvestmentCalculator,
    retirement: RetirementCalculator,
  } as const;

/**
 * Get calculator component by type
 */
export function getCalculatorComponent(type: CalculationType): ComponentType {
  return CALCULATOR_COMPONENT_MAP[type];
}
