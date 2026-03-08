/**
 * Calculator Service
 *
 * Service for performing various financial calculations including
 * mortgage, loan, investment, and retirement calculations.
 */

import {
  CalculationType,
  MortgageInputs,
  MortgageResult,
  LoanInputs,
  LoanResult,
  InvestmentInputs,
  InvestmentResult,
  RetirementInputs,
  RetirementResult,
  CalculationResponse,
} from "../types/calculator.types";
import { debugLog } from "@/shared/utils/debug";

const SERVICE_NAME = "calculator-service";

export class CalculatorService {
  /**
   * Calculate mortgage payment
   */
  static calculateMortgage(inputs: MortgageInputs): MortgageResult {
    const startTime = Date.now();

    try {
      const {
        loanAmount,
        interestRate,
        loanTerm,
        downPayment = 0,
        propertyTax = 0,
        homeInsurance = 0,
        pmi = 0,
      } = inputs;

      const principal = loanAmount - downPayment;
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = loanTerm * 12;

      // Calculate monthly principal and interest
      const monthlyPrincipalAndInterest =
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1);

      // Calculate monthly taxes, insurance, and PMI
      const monthlyTaxesAndInsurance = (propertyTax + homeInsurance + pmi) / 12;
      const monthlyPayment =
        monthlyPrincipalAndInterest + monthlyTaxesAndInsurance;

      // Calculate totals
      const totalPayment = monthlyPayment * numPayments;
      const totalInterest = totalPayment - principal;

      // Generate amortization schedule
      const amortizationSchedule =
        CalculatorService.generateAmortizationSchedule(
          principal,
          monthlyRate,
          numPayments,
          monthlyPrincipalAndInterest
        );

      const calculationTime = Date.now() - startTime;

      debugLog.info(
        "Mortgage calculation completed",
        {
          service: SERVICE_NAME,
          operation: "calculateMortgage",
        },
        {
          calculationTime: `${calculationTime}ms`,
        }
      );

      return {
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        monthlyPrincipalAndInterest:
          Math.round(monthlyPrincipalAndInterest * 100) / 100,
        monthlyTaxesAndInsurance:
          Math.round(monthlyTaxesAndInsurance * 100) / 100,
        amortizationSchedule,
      };
    } catch (error) {
      debugLog.error(
        "Error calculating mortgage",
        {
          service: SERVICE_NAME,
          operation: "calculateMortgage",
        },
        error
      );
      throw new Error("Failed to calculate mortgage payment");
    }
  }

  /**
   * Calculate loan payment
   */
  static calculateLoan(inputs: LoanInputs): LoanResult {
    const startTime = Date.now();

    try {
      const { principal, interestRate, term } = inputs;

      const monthlyRate = interestRate / 100 / 12;

      // Calculate monthly payment
      const monthlyPayment =
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, term))) /
        (Math.pow(1 + monthlyRate, term) - 1);

      // Calculate totals
      const totalPayment = monthlyPayment * term;
      const totalInterest = totalPayment - principal;

      // Generate amortization schedule
      const amortizationSchedule =
        CalculatorService.generateAmortizationSchedule(
          principal,
          monthlyRate,
          term,
          monthlyPayment
        );

      const calculationTime = Date.now() - startTime;

      debugLog.info(
        "Loan calculation completed",
        {
          service: SERVICE_NAME,
          operation: "calculateLoan",
        },
        {
          calculationTime: `${calculationTime}ms`,
        }
      );

      return {
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        amortizationSchedule,
      };
    } catch (error) {
      debugLog.error(
        "Error calculating loan",
        {
          service: SERVICE_NAME,
          operation: "calculateLoan",
        },
        error
      );
      throw new Error("Failed to calculate loan payment");
    }
  }

  /**
   * Calculate investment future value
   */
  static calculateInvestment(inputs: InvestmentInputs): InvestmentResult {
    const startTime = Date.now();

    try {
      const {
        initialInvestment,
        monthlyContribution = 0,
        annualInterestRate,
        years,
        compoundFrequency = 12,
      } = inputs;

      const monthlyRate = annualInterestRate / 100 / compoundFrequency;
      const totalPeriods = years * compoundFrequency;

      // Future value of initial investment
      const futureValueOfInitial =
        initialInvestment * Math.pow(1 + monthlyRate, totalPeriods);

      // Future value of monthly contributions
      let futureValueOfContributions = 0;
      if (monthlyContribution > 0) {
        futureValueOfContributions =
          monthlyContribution *
          ((Math.pow(1 + monthlyRate, totalPeriods) - 1) / monthlyRate);
      }

      const futureValue = futureValueOfInitial + futureValueOfContributions;
      const totalContributions =
        initialInvestment + monthlyContribution * totalPeriods;
      const totalInterest = futureValue - totalContributions;

      // Generate growth chart
      const growthChart = this.generateInvestmentGrowthChart(
        initialInvestment,
        monthlyContribution,
        monthlyRate,
        years,
        compoundFrequency
      );

      const calculationTime = Date.now() - startTime;

      debugLog.info(
        "Investment calculation completed",
        {
          service: SERVICE_NAME,
          operation: "calculateInvestment",
        },
        {
          calculationTime: `${calculationTime}ms`,
        }
      );

      return {
        futureValue: Math.round(futureValue * 100) / 100,
        totalContributions: Math.round(totalContributions * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        growthChart,
      };
    } catch (error) {
      debugLog.error(
        "Error calculating investment",
        {
          service: SERVICE_NAME,
          operation: "calculateInvestment",
        },
        error
      );
      throw new Error("Failed to calculate investment future value");
    }
  }

  /**
   * Calculate retirement readiness
   */
  static calculateRetirement(inputs: RetirementInputs): RetirementResult {
    const startTime = Date.now();

    try {
      const {
        currentAge,
        retirementAge,
        currentSavings,
        monthlyContribution,
        annualReturnRate,
        expectedRetirementSpending,
        lifeExpectancy = 85,
      } = inputs;

      const yearsToRetirement = retirementAge - currentAge;
      const yearsInRetirement = lifeExpectancy - retirementAge;
      const monthlyRate = annualReturnRate / 100 / 12;
      const totalMonths = yearsToRetirement * 12;

      // Calculate retirement savings at retirement age
      const futureValueOfCurrentSavings =
        currentSavings * Math.pow(1 + monthlyRate, totalMonths);

      const futureValueOfContributions =
        monthlyContribution *
        ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);

      const retirementSavings =
        futureValueOfCurrentSavings + futureValueOfContributions;

      // Calculate if savings can support retirement spending
      // Using 4% withdrawal rule as a conservative estimate
      const safeWithdrawalRate = 0.04;
      const annualRetirementSpending = expectedRetirementSpending * 12;
      const requiredSavings = annualRetirementSpending / safeWithdrawalRate;

      const isOnTrack = retirementSavings >= requiredSavings;
      const shortfall = isOnTrack
        ? undefined
        : requiredSavings - retirementSavings;
      const surplus = isOnTrack
        ? retirementSavings - requiredSavings
        : undefined;

      // Calculate monthly retirement income from savings
      const monthlyRetirementIncome =
        (retirementSavings * safeWithdrawalRate) / 12;

      // Generate recommendations
      const recommendations: string[] = [];
      if (!isOnTrack && shortfall) {
        recommendations.push(
          `You need to save an additional $${Math.round(shortfall).toLocaleString()} to meet your retirement goals.`
        );
        const additionalMonthly = shortfall / totalMonths;
        recommendations.push(
          `Consider increasing monthly contributions by $${Math.round(additionalMonthly).toLocaleString()}.`
        );
      } else if (surplus) {
        recommendations.push(
          `Great! You're on track with a surplus of $${Math.round(surplus).toLocaleString()}.`
        );
      }

      if (yearsToRetirement < 10) {
        recommendations.push(
          "Consider consulting a financial advisor as you approach retirement."
        );
      }

      const calculationTime = Date.now() - startTime;

      debugLog.info(
        "Retirement calculation completed",
        {
          service: SERVICE_NAME,
          operation: "calculateRetirement",
        },
        {
          calculationTime: `${calculationTime}ms`,
        }
      );

      return {
        retirementSavings: Math.round(retirementSavings * 100) / 100,
        yearsInRetirement,
        monthlyRetirementIncome:
          Math.round(monthlyRetirementIncome * 100) / 100,
        isOnTrack,
        shortfall: shortfall ? Math.round(shortfall * 100) / 100 : undefined,
        surplus: surplus ? Math.round(surplus * 100) / 100 : undefined,
        recommendations,
      };
    } catch (error) {
      debugLog.error(
        "Error calculating retirement",
        {
          service: SERVICE_NAME,
          operation: "calculateRetirement",
        },
        error
      );
      throw new Error("Failed to calculate retirement readiness");
    }
  }

  /**
   * Generate amortization schedule (shared by mortgage and loan calculators)
   */
  private static generateAmortizationSchedule(
    principal: number,
    monthlyRate: number,
    numPayments: number,
    monthlyPayment: number
  ) {
    const schedule = [];
    let remainingBalance = principal;

    for (let month = 1; month <= numPayments; month++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      schedule.push({
        month,
        payment: Math.round(monthlyPayment * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interestPayment * 100) / 100,
        remainingBalance: Math.round(Math.max(0, remainingBalance) * 100) / 100,
      });
    }

    return schedule;
  }

  /**
   * Generate investment growth chart
   */
  private static generateInvestmentGrowthChart(
    initialInvestment: number,
    monthlyContribution: number,
    monthlyRate: number,
    years: number,
    compoundFrequency: number
  ) {
    const chart = [];
    let currentValue = initialInvestment;
    const periodsPerYear = compoundFrequency;
    const totalPeriods = years * periodsPerYear;

    for (let period = 0; period <= totalPeriods; period += periodsPerYear) {
      const year = period / periodsPerYear;

      if (year > 0) {
        // Calculate value at end of year
        for (let p = 0; p < periodsPerYear; p++) {
          currentValue = currentValue * (1 + monthlyRate) + monthlyContribution;
        }
      }

      const contributions = initialInvestment + monthlyContribution * period;
      const interest = currentValue - contributions;

      chart.push({
        year,
        value: Math.round(currentValue * 100) / 100,
        contributions: Math.round(contributions * 100) / 100,
        interest: Math.round(interest * 100) / 100,
      });
    }

    return chart;
  }

  /**
   * Perform calculation based on type
   * Uses function overloads for type safety
   */
  static performCalculation(
    type: "mortgage",
    inputs: MortgageInputs
  ): CalculationResponse;
  static performCalculation(
    type: "loan",
    inputs: LoanInputs
  ): CalculationResponse;
  static performCalculation(
    type: "investment",
    inputs: InvestmentInputs
  ): CalculationResponse;
  static performCalculation(
    type: "retirement",
    inputs: RetirementInputs
  ): CalculationResponse;
  static performCalculation(
    type: CalculationType,
    inputs: MortgageInputs | LoanInputs | InvestmentInputs | RetirementInputs
  ): CalculationResponse {
    const startTime = Date.now();
    let results:
      | MortgageResult
      | LoanResult
      | InvestmentResult
      | RetirementResult;

    switch (type) {
      case "mortgage":
        // Type narrowing: TypeScript knows inputs is MortgageInputs when type is 'mortgage'
        // This is safe because the API layer validates inputs before calling this method
        results = this.calculateMortgage(inputs as MortgageInputs);
        break;
      case "loan":
        results = this.calculateLoan(inputs as LoanInputs);
        break;
      case "investment":
        results = this.calculateInvestment(inputs as InvestmentInputs);
        break;
      case "retirement":
        results = this.calculateRetirement(inputs as RetirementInputs);
        break;
      default: {
        // Exhaustiveness check - TypeScript will error if we miss a case
        const _exhaustive: never = type;
        throw new Error(`Unsupported calculation type: ${_exhaustive}`);
      }
    }

    const calculationTime = Date.now() - startTime;

    return {
      type,
      inputs: inputs as unknown as Record<string, unknown>,
      results,
      calculationTime,
    };
  }
}
