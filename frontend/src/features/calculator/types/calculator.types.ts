/**
 * Calculator Types
 *
 * TypeScript types for calculator-related data structures.
 *
 * NOTE: CalculationType and VALID_CALCULATION_TYPES are now exported from
 * calculator.constants.ts to ensure single source of truth.
 * Import them from '@/features/calculator/constants/calculator.constants'
 */

// Re-export from constants for backward compatibility
import type { CalculationType } from "../constants/calculator.constants";
import { VALID_CALCULATION_TYPES } from "../constants/calculator.constants";

export type { CalculationType };
export { VALID_CALCULATION_TYPES };

export interface MortgageInputs {
  loanAmount: number;
  interestRate: number; // Annual percentage rate
  loanTerm: number; // Years
  downPayment?: number;
  propertyTax?: number; // Annual
  homeInsurance?: number; // Annual
  pmi?: number; // Private Mortgage Insurance, annual
}

export interface MortgageResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  monthlyPrincipalAndInterest: number;
  monthlyTaxesAndInsurance?: number;
  amortizationSchedule?: AmortizationScheduleEntry[];
}

export interface AmortizationScheduleEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface LoanInputs {
  principal: number;
  interestRate: number; // Annual percentage rate
  term: number; // Months
}

export interface LoanResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  amortizationSchedule?: AmortizationScheduleEntry[];
}

export interface InvestmentInputs {
  initialInvestment: number;
  monthlyContribution?: number;
  annualInterestRate: number; // Percentage
  years: number;
  compoundFrequency?: number; // Times per year (default: 12 for monthly)
}

export interface InvestmentResult {
  futureValue: number;
  totalContributions: number;
  totalInterest: number;
  growthChart?: InvestmentGrowthEntry[];
}

export interface InvestmentGrowthEntry {
  year: number;
  value: number;
  contributions: number;
  interest: number;
}

export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  annualReturnRate: number; // Percentage
  expectedRetirementSpending: number; // Monthly
  lifeExpectancy?: number; // Default: 85
}

export interface RetirementResult {
  retirementSavings: number;
  yearsInRetirement: number;
  monthlyRetirementIncome: number;
  isOnTrack: boolean;
  shortfall?: number;
  surplus?: number;
  recommendations?: string[];
}

export interface CalculationRequest {
  type: CalculationType;
  inputs: MortgageInputs | LoanInputs | InvestmentInputs | RetirementInputs;
}

export interface CalculationResponse {
  type: CalculationType;
  inputs: Record<string, unknown>;
  results: MortgageResult | LoanResult | InvestmentResult | RetirementResult;
  calculationTime: number; // milliseconds
}

export interface CalculationHistory {
  id: string;
  userId: string;
  type: CalculationType;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  createdAt: Date;
}
