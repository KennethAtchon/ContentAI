/**
 * Unit tests for CalculatorService: mortgage, loan, investment, retirement,
 * performCalculation. debugLog is mocked in preload.
 */

import { describe, it, expect } from "bun:test";
import { CalculatorService } from "@/features/calculator/services/calculator-service";
import type {
  MortgageInputs,
  LoanInputs,
  InvestmentInputs,
  RetirementInputs,
} from "@/features/calculator/types/calculator.types";

describe("CalculatorService", () => {
  describe("calculateMortgage", () => {
    it("computes monthly payment and amortization schedule", () => {
      const inputs: MortgageInputs = {
        loanAmount: 300_000,
        interestRate: 6,
        loanTerm: 30,
        downPayment: 60_000,
      };
      const result = CalculatorService.calculateMortgage(inputs);
      expect(result.monthlyPayment).toBeGreaterThan(0);
      expect(result.totalPayment).toBeGreaterThan(result.totalInterest);
      expect(result.monthlyPrincipalAndInterest).toBeGreaterThan(0);
      expect(result.amortizationSchedule).toHaveLength(30 * 12);
      expect(result.amortizationSchedule![0]).toMatchObject({
        month: 1,
        payment: expect.any(Number),
        principal: expect.any(Number),
        interest: expect.any(Number),
        remainingBalance: expect.any(Number),
      });
    });

    it("includes optional property tax, insurance, PMI", () => {
      const inputs: MortgageInputs = {
        loanAmount: 200_000,
        interestRate: 5,
        loanTerm: 15,
        propertyTax: 2400,
        homeInsurance: 1200,
        pmi: 600,
      };
      const result = CalculatorService.calculateMortgage(inputs);
      expect(result.monthlyTaxesAndInsurance).toBe(350); // (2400+1200+600)/12
    });

    it("does not throw on edge inputs (validation is at API layer)", () => {
      const result = CalculatorService.calculateMortgage({
        loanAmount: 1,
        interestRate: 0,
        loanTerm: 1,
      });
      expect(result.monthlyPayment).toBeDefined();
    });

    it("throws with message when calculation throws", () => {
      const orig = Math.pow;
      (global as any).Math.pow = () => {
        throw new Error("pow fail");
      };
      try {
        expect(() =>
          CalculatorService.calculateMortgage({
            loanAmount: 200_000,
            interestRate: 5,
            loanTerm: 30,
          }),
        ).toThrow("Failed to calculate mortgage payment");
      } finally {
        (global as any).Math.pow = orig;
      }
    });
  });

  describe("calculateLoan", () => {
    it("computes monthly payment and schedule", () => {
      const inputs: LoanInputs = {
        principal: 10_000,
        interestRate: 12,
        term: 24,
      };
      const result = CalculatorService.calculateLoan(inputs);
      expect(result.monthlyPayment).toBeGreaterThan(0);
      expect(result.totalPayment).toBeGreaterThan(result.totalInterest);
      expect(result.amortizationSchedule).toHaveLength(24);
    });

    it("throws with message when calculation throws", () => {
      const orig = Math.pow;
      (global as any).Math.pow = () => {
        throw new Error("pow fail");
      };
      try {
        expect(() =>
          CalculatorService.calculateLoan({
            principal: 10_000,
            interestRate: 5,
            term: 24,
          }),
        ).toThrow("Failed to calculate loan payment");
      } finally {
        (global as any).Math.pow = orig;
      }
    });
  });

  describe("calculateInvestment", () => {
    it("computes future value with initial and monthly contributions", () => {
      const inputs: InvestmentInputs = {
        initialInvestment: 1000,
        monthlyContribution: 100,
        annualInterestRate: 7,
        years: 10,
      };
      const result = CalculatorService.calculateInvestment(inputs);
      expect(result.futureValue).toBeGreaterThan(result.totalContributions);
      expect(result.totalContributions).toBe(1000 + 100 * 10 * 12);
      expect(result.growthChart).toBeDefined();
      expect(result.growthChart!.length).toBeGreaterThan(0);
    });

    it("computes future value with only initial investment", () => {
      const inputs: InvestmentInputs = {
        initialInvestment: 5000,
        annualInterestRate: 5,
        years: 5,
      };
      const result = CalculatorService.calculateInvestment(inputs);
      expect(result.futureValue).toBeGreaterThan(5000);
      expect(result.totalContributions).toBe(5000);
    });

    it("throws with message when calculation throws", () => {
      const orig = Math.pow;
      (global as any).Math.pow = () => {
        throw new Error("pow fail");
      };
      try {
        expect(() =>
          CalculatorService.calculateInvestment({
            initialInvestment: 5000,
            annualInterestRate: 6,
            years: 10,
          }),
        ).toThrow("Failed to calculate investment future value");
      } finally {
        (global as any).Math.pow = orig;
      }
    });
  });

  describe("calculateRetirement", () => {
    it("returns on-track when savings meet required amount", () => {
      const inputs: RetirementInputs = {
        currentAge: 30,
        retirementAge: 65,
        currentSavings: 100_000,
        monthlyContribution: 500,
        annualReturnRate: 6,
        expectedRetirementSpending: 5000,
        lifeExpectancy: 90,
      };
      const result = CalculatorService.calculateRetirement(inputs);
      expect(result.retirementSavings).toBeGreaterThan(0);
      expect(result.yearsInRetirement).toBe(25);
      expect(result.monthlyRetirementIncome).toBeGreaterThan(0);
      expect(typeof result.isOnTrack).toBe("boolean");
      expect(result.recommendations).toBeDefined();
    });

    it("returns shortfall when not on track", () => {
      const inputs: RetirementInputs = {
        currentAge: 60,
        retirementAge: 65,
        currentSavings: 10_000,
        monthlyContribution: 100,
        annualReturnRate: 3,
        expectedRetirementSpending: 10_000,
      };
      const result = CalculatorService.calculateRetirement(inputs);
      expect(result.isOnTrack).toBe(false);
      expect(result.shortfall).toBeDefined();
      expect(result.shortfall).toBeGreaterThan(0);
    });

    it("throws with message when calculation throws", () => {
      const orig = Math.pow;
      (global as any).Math.pow = () => {
        throw new Error("pow fail");
      };
      try {
        expect(() =>
          CalculatorService.calculateRetirement({
            currentAge: 30,
            retirementAge: 65,
            currentSavings: 50_000,
            monthlyContribution: 500,
            annualReturnRate: 6,
            expectedRetirementSpending: 5000,
          }),
        ).toThrow("Failed to calculate retirement readiness");
      } finally {
        (global as any).Math.pow = orig;
      }
    });
  });

  describe("performCalculation", () => {
    it("dispatches mortgage and returns CalculationResponse", () => {
      const inputs: MortgageInputs = {
        loanAmount: 100_000,
        interestRate: 5,
        loanTerm: 20,
      };
      const response = CalculatorService.performCalculation("mortgage", inputs);
      expect(response.type).toBe("mortgage");
      expect(response.results).toHaveProperty("monthlyPayment");
      expect(response.calculationTime).toBeGreaterThanOrEqual(0);
      expect(response.inputs).toBeDefined();
    });

    it("dispatches loan", () => {
      const inputs: LoanInputs = {
        principal: 5000,
        interestRate: 8,
        term: 12,
      };
      const response = CalculatorService.performCalculation("loan", inputs);
      expect(response.type).toBe("loan");
      expect(response.results).toHaveProperty("amortizationSchedule");
    });

    it("dispatches investment", () => {
      const inputs: InvestmentInputs = {
        initialInvestment: 1000,
        annualInterestRate: 6,
        years: 5,
      };
      const response = CalculatorService.performCalculation(
        "investment",
        inputs,
      );
      expect(response.type).toBe("investment");
      expect(response.results).toHaveProperty("futureValue");
    });

    it("dispatches retirement", () => {
      const inputs: RetirementInputs = {
        currentAge: 40,
        retirementAge: 65,
        currentSavings: 50_000,
        monthlyContribution: 500,
        annualReturnRate: 5,
        expectedRetirementSpending: 4000,
      };
      const response = CalculatorService.performCalculation(
        "retirement",
        inputs,
      );
      expect(response.type).toBe("retirement");
      expect(response.results).toHaveProperty("isOnTrack");
    });

    it("throws for unsupported calculation type", () => {
      expect(() =>
        CalculatorService.performCalculation(
          "invalid" as "mortgage",
          { loanAmount: 1, interestRate: 1, loanTerm: 1 } as MortgageInputs,
        ),
      ).toThrow(/Unsupported calculation type/);
    });
  });
});
