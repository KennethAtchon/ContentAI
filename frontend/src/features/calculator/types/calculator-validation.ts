/**
 * Calculator Input Validation Schemas
 *
 * Zod schemas for validating calculator inputs at runtime.
 * Provides type-safe validation and error messages.
 */

import { z } from "zod";

/**
 * Base number validation - positive, finite, reasonable bounds
 */
const positiveNumberSchema = z
  .number({
    message: "Must be a number",
  })
  .finite("Must be a finite number")
  .nonnegative("Must be a positive number or zero");

const percentageSchema = z
  .number({
    message: "Interest rate must be a number",
  })
  .min(0, "Interest rate cannot be negative")
  .max(100, "Interest rate cannot exceed 100%")
  .finite("Interest rate must be a finite number");

const positiveIntegerSchema = z
  .number({
    message: "Must be a number",
  })
  .int("Must be a whole number")
  .positive("Must be greater than zero")
  .finite("Must be a finite number");

/**
 * Mortgage Calculator Input Schema
 */
export const mortgageInputSchema = z
  .object({
    loanAmount: positiveNumberSchema.min(1, "Loan amount must be at least $1"),
    interestRate: percentageSchema,
    loanTerm: positiveIntegerSchema
      .min(1, "Loan term must be at least 1 year")
      .max(50, "Loan term cannot exceed 50 years"),
    downPayment: positiveNumberSchema.optional(),
    propertyTax: positiveNumberSchema.optional(),
    homeInsurance: positiveNumberSchema.optional(),
    pmi: positiveNumberSchema.optional(),
  })
  .refine((data) => !data.downPayment || data.downPayment < data.loanAmount, {
    message: "Down payment must be less than loan amount",
    path: ["downPayment"],
  });

/**
 * Loan Calculator Input Schema
 */
export const loanInputSchema = z.object({
  principal: positiveNumberSchema.min(1, "Principal must be at least $1"),
  interestRate: percentageSchema,
  term: positiveIntegerSchema
    .min(1, "Term must be at least 1 month")
    .max(600, "Term cannot exceed 600 months (50 years)"),
});

/**
 * Investment Calculator Input Schema
 */
export const investmentInputSchema = z.object({
  initialInvestment: positiveNumberSchema.min(
    0,
    "Initial investment cannot be negative"
  ),
  monthlyContribution: positiveNumberSchema.optional(),
  annualInterestRate: percentageSchema,
  years: positiveIntegerSchema
    .min(1, "Investment period must be at least 1 year")
    .max(100, "Investment period cannot exceed 100 years"),
  compoundFrequency: z
    .number()
    .int()
    .min(1, "Compound frequency must be at least 1")
    .max(365, "Compound frequency cannot exceed 365")
    .optional(),
});

/**
 * Retirement Calculator Input Schema
 */
export const retirementInputSchema = z
  .object({
    currentAge: positiveIntegerSchema
      .min(18, "Current age must be at least 18")
      .max(100, "Current age cannot exceed 100"),
    retirementAge: positiveIntegerSchema
      .min(18, "Retirement age must be at least 18")
      .max(100, "Retirement age cannot exceed 100"),
    currentSavings: positiveNumberSchema.min(
      0,
      "Current savings cannot be negative"
    ),
    monthlyContribution: positiveNumberSchema.min(
      0,
      "Monthly contribution cannot be negative"
    ),
    annualReturnRate: percentageSchema,
    expectedRetirementSpending: positiveNumberSchema.min(
      1,
      "Expected retirement spending must be at least $1"
    ),
    lifeExpectancy: positiveIntegerSchema
      .min(50, "Life expectancy must be at least 50")
      .max(120, "Life expectancy cannot exceed 120")
      .optional(),
  })
  .refine((data) => data.retirementAge > data.currentAge, {
    message: "Retirement age must be greater than current age",
    path: ["retirementAge"],
  })
  .refine(
    (data) => !data.lifeExpectancy || data.lifeExpectancy > data.retirementAge,
    {
      message: "Life expectancy must be greater than retirement age",
      path: ["lifeExpectancy"],
    }
  );

/**
 * Calculation Request Schema (for API validation)
 */
export const calculationRequestSchema = z.object({
  type: z.enum(["mortgage", "loan", "investment", "retirement"], {
    message: "Calculation type is required",
  }),
  inputs: z.union([
    mortgageInputSchema,
    loanInputSchema,
    investmentInputSchema,
    retirementInputSchema,
  ]),
});

/**
 * Type-safe validation function
 */
export function validateCalculatorInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", "),
    details: result.error.issues,
  };
}
