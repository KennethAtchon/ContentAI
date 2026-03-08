/**
 * Unit tests for calculator validation schemas and validateCalculatorInput.
 */

import { describe, it, expect } from "bun:test";
import {
  mortgageInputSchema,
  loanInputSchema,
  investmentInputSchema,
  retirementInputSchema,
  calculationRequestSchema,
  validateCalculatorInput,
} from "@/features/calculator/types/calculator-validation";

describe("calculator-validation", () => {
  describe("mortgageInputSchema", () => {
    it("accepts valid mortgage inputs", () => {
      const result = mortgageInputSchema.safeParse({
        loanAmount: 300000,
        interestRate: 5.5,
        loanTerm: 30,
        downPayment: 60000,
      });
      expect(result.success).toBe(true);
    });

    it("rejects downPayment >= loanAmount", () => {
      const result = mortgageInputSchema.safeParse({
        loanAmount: 100000,
        interestRate: 5,
        loanTerm: 20,
        downPayment: 100000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative loan amount", () => {
      const result = mortgageInputSchema.safeParse({
        loanAmount: -1,
        interestRate: 5,
        loanTerm: 30,
      });
      expect(result.success).toBe(false);
    });

    it("rejects interest rate > 100", () => {
      const result = mortgageInputSchema.safeParse({
        loanAmount: 100000,
        interestRate: 101,
        loanTerm: 30,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loanInputSchema", () => {
    it("accepts valid loan inputs", () => {
      const result = loanInputSchema.safeParse({
        principal: 10000,
        interestRate: 8,
        term: 24,
      });
      expect(result.success).toBe(true);
    });

    it("rejects term > 600 months", () => {
      const result = loanInputSchema.safeParse({
        principal: 10000,
        interestRate: 5,
        term: 601,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("investmentInputSchema", () => {
    it("accepts valid investment inputs", () => {
      const result = investmentInputSchema.safeParse({
        initialInvestment: 5000,
        monthlyContribution: 200,
        annualInterestRate: 7,
        years: 10,
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional compoundFrequency", () => {
      const result = investmentInputSchema.safeParse({
        initialInvestment: 1000,
        annualInterestRate: 5,
        years: 5,
        compoundFrequency: 12,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("retirementInputSchema", () => {
    it("accepts valid retirement inputs", () => {
      const result = retirementInputSchema.safeParse({
        currentAge: 35,
        retirementAge: 65,
        currentSavings: 50000,
        monthlyContribution: 500,
        annualReturnRate: 6,
        expectedRetirementSpending: 4000,
      });
      expect(result.success).toBe(true);
    });

    it("rejects retirementAge <= currentAge", () => {
      const result = retirementInputSchema.safeParse({
        currentAge: 65,
        retirementAge: 65,
        currentSavings: 0,
        monthlyContribution: 0,
        annualReturnRate: 5,
        expectedRetirementSpending: 3000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects lifeExpectancy <= retirementAge when provided", () => {
      const result = retirementInputSchema.safeParse({
        currentAge: 30,
        retirementAge: 65,
        currentSavings: 0,
        monthlyContribution: 0,
        annualReturnRate: 5,
        expectedRetirementSpending: 3000,
        lifeExpectancy: 65,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("calculationRequestSchema", () => {
    it("accepts valid calculation request", () => {
      const result = calculationRequestSchema.safeParse({
        type: "mortgage",
        inputs: {
          loanAmount: 200000,
          interestRate: 4,
          loanTerm: 25,
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = calculationRequestSchema.safeParse({
        type: "invalid",
        inputs: { loanAmount: 1, interestRate: 1, loanTerm: 1 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateCalculatorInput", () => {
    it("returns success and data when valid", () => {
      const out = validateCalculatorInput(loanInputSchema, {
        principal: 5000,
        interestRate: 6,
        term: 12,
      });
      expect(out.success).toBe(true);
      if (out.success) {
        expect(out.data.principal).toBe(5000);
        expect(out.data.term).toBe(12);
      }
    });

    it("returns success: false and error string when invalid", () => {
      const out = validateCalculatorInput(loanInputSchema, {
        principal: -1,
        interestRate: 6,
        term: 12,
      });
      expect(out.success).toBe(false);
      if (!out.success) {
        expect(out.error).toBeDefined();
        expect(out.details).toBeDefined();
        expect(Array.isArray(out.details)).toBe(true);
      }
    });
  });
});
