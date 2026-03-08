/**
 * Mortgage Calculator Component
 *
 * Calculator for mortgage payments including principal, interest, taxes, and insurance.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { CalculatorInput } from "./calculator-input";
import { useCalculator } from "../hooks/use-calculator";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { MortgageInputs, MortgageResult } from "../types/calculator.types";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Loader2, Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

export function MortgageCalculator() {
  const { t } = useTranslation();
  const { role } = useSubscription();
  const {
    calculate,
    isLoading,
    error: calcError,
    usageLimitReached,
  } = useCalculator();
  const [inputs, setInputs] = useState<MortgageInputs>({
    loanAmount: 0,
    interestRate: 0,
    loanTerm: 30,
    downPayment: 0,
    propertyTax: 0,
    homeInsurance: 0,
    pmi: 0,
  });
  const [result, setResult] = useState<MortgageResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Memoize validation function
  const validateInputs = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (inputs.loanAmount <= 0) {
      newErrors.loanAmount = t("calculator_mortgage_error_loan_amount");
    }
    if (inputs.interestRate <= 0 || inputs.interestRate > 100) {
      newErrors.interestRate = t("calculator_mortgage_error_interest_rate");
    }
    if (inputs.loanTerm <= 0) {
      newErrors.loanTerm = t("calculator_mortgage_error_loan_term");
    }
    if (inputs.downPayment && inputs.downPayment >= inputs.loanAmount) {
      newErrors.downPayment = t("calculator_mortgage_error_down_payment");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inputs, t]);

  // Memoize calculate handler
  const handleCalculate = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    const calculationResult = await calculate("mortgage", inputs);
    if (calculationResult) {
      setResult(calculationResult.results as MortgageResult);
    }
  }, [inputs, validateInputs, calculate]);

  // Memoize amortization schedule display
  const showAmortization = useMemo(
    () =>
      result?.amortizationSchedule && result.amortizationSchedule.length > 0,
    [result?.amortizationSchedule]
  );

  // Memoize first 12 months of amortization schedule
  const amortizationPreview = useMemo(
    () => result?.amortizationSchedule?.slice(0, 12) || [],
    [result?.amortizationSchedule]
  );

  // Memoize input change handlers
  const handleLoanAmountChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, loanAmount: value })),
    []
  );

  const handleInterestRateChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, interestRate: value })),
    []
  );

  const handleLoanTermChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, loanTerm: value })),
    []
  );

  const handleDownPaymentChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, downPayment: value })),
    []
  );

  const handlePropertyTaxChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, propertyTax: value })),
    []
  );

  const handlePmiChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, pmi: value })),
    []
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t("home_features_mortgage_title")}
          </CardTitle>
          <CardDescription>
            {t("calculator_mortgage_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <CalculatorInput
              label={t("calculator_mortgage_loan_amount")}
              name="loanAmount"
              value={inputs.loanAmount}
              onChange={handleLoanAmountChange}
              type="currency"
              prefix="$"
              required
              error={errors.loanAmount}
            />
            <CalculatorInput
              label={t("calculator_mortgage_interest_rate")}
              name="interestRate"
              value={inputs.interestRate}
              onChange={handleInterestRateChange}
              type="percentage"
              suffix="%"
              required
              min={0}
              max={100}
              error={errors.interestRate}
            />
            <CalculatorInput
              label={t("calculator_mortgage_loan_term")}
              name="loanTerm"
              value={inputs.loanTerm}
              onChange={handleLoanTermChange}
              suffix={t("calculator_years")}
              required
              min={1}
              max={50}
              error={errors.loanTerm}
            />
            <CalculatorInput
              label={t("calculator_mortgage_down_payment")}
              name="downPayment"
              value={inputs.downPayment || 0}
              onChange={handleDownPaymentChange}
              type="currency"
              prefix="$"
              min={0}
            />
            <CalculatorInput
              label={t("calculator_mortgage_annual_property_tax")}
              name="propertyTax"
              value={inputs.propertyTax || 0}
              onChange={handlePropertyTaxChange}
              type="currency"
              prefix="$"
              min={0}
            />
            <CalculatorInput
              label={t("calculator_mortgage_annual_home_insurance")}
              name="homeInsurance"
              value={inputs.homeInsurance || 0}
              onChange={(value) =>
                setInputs({ ...inputs, homeInsurance: value })
              }
              type="currency"
              prefix="$"
              min={0}
            />
            <CalculatorInput
              label={t("calculator_mortgage_annual_pmi")}
              name="pmi"
              value={inputs.pmi || 0}
              onChange={handlePmiChange}
              type="currency"
              prefix="$"
              min={0}
            />
          </div>

          {calcError && (
            <Alert variant="destructive">
              <AlertDescription>{calcError}</AlertDescription>
            </Alert>
          )}

          {usageLimitReached && role && (
            <Alert>
              <AlertDescription>
                {t(
                  "common_you_have_reached_your_monthly_calculation_limit_please_upgra"
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleCalculate}
            disabled={isLoading || usageLimitReached}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("calculator_mortgage_calculating")}
              </>
            ) : (
              t("calculator_mortgage_calculate")
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t("calculator_mortgage_results")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_mortgage_monthly_payment")}
                </p>
                <p className="text-2xl font-bold">
                  $
                  {result.monthlyPayment.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_mortgage_principal_interest")}
                </p>
                <p className="text-xl font-semibold">
                  $
                  {result.monthlyPrincipalAndInterest.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_mortgage_total_payment")}
                </p>
                <p className="text-xl font-semibold">
                  $
                  {result.totalPayment.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_mortgage_total_interest")}
                </p>
                <p className="text-xl font-semibold">
                  $
                  {result.totalInterest.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {showAmortization && (
              <div className="mt-6">
                <h3 className="mb-4 text-lg font-semibold">
                  {t("calculator_mortgage_amortization_schedule")}
                </h3>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("calculator_mortgage_amortization_month")}
                        </TableHead>
                        <TableHead>
                          {t("calculator_mortgage_amortization_payment")}
                        </TableHead>
                        <TableHead>
                          {t("calculator_mortgage_amortization_principal")}
                        </TableHead>
                        <TableHead>
                          {t("calculator_mortgage_amortization_interest")}
                        </TableHead>
                        <TableHead>
                          {t("calculator_mortgage_amortization_balance")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {amortizationPreview.map((entry) => (
                        <TableRow key={entry.month}>
                          <TableCell>{entry.month}</TableCell>
                          <TableCell>
                            $
                            {entry.payment.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            $
                            {entry.principal.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            $
                            {entry.interest.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            $
                            {entry.remainingBalance.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
