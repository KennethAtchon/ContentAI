/**
 * Loan Calculator Component
 *
 * Calculator for loan payments and amortization.
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
import {
  LoanInputs,
  LoanResult,
  AmortizationScheduleEntry,
} from "../types/calculator.types";
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

export function LoanCalculator() {
  const { t } = useTranslation();
  const { role } = useSubscription();
  const {
    calculate,
    isLoading,
    error: calcError,
    usageLimitReached,
  } = useCalculator();
  const [inputs, setInputs] = useState<LoanInputs>({
    principal: 0,
    interestRate: 0,
    term: 0,
  });
  const [result, setResult] = useState<LoanResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Memoize validation function
  const validateInputs = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (inputs.principal <= 0) {
      newErrors.principal = t("calculator_loan_error_principal");
    }
    if (inputs.interestRate <= 0 || inputs.interestRate > 100) {
      newErrors.interestRate = t("calculator_mortgage_error_interest_rate");
    }
    if (inputs.term <= 0) {
      newErrors.term = t("calculator_mortgage_error_loan_term");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inputs, t]);

  // Memoize calculate handler
  const handleCalculate = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    const calculationResult = await calculate("loan", inputs);
    if (calculationResult) {
      setResult(calculationResult.results as LoanResult);
    }
  }, [inputs, validateInputs, calculate]);

  // Memoize input change handlers
  const handlePrincipalChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, principal: value })),
    []
  );

  const handleInterestRateChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, interestRate: value })),
    []
  );

  const handleTermChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, term: value })),
    []
  );

  // Memoize payment schedule preview
  const paymentSchedulePreview = useMemo(
    () => result?.amortizationSchedule?.slice(0, 12) || [],
    [result?.amortizationSchedule]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t("home_features_loan_title")}
          </CardTitle>
          <CardDescription>
            {t("common_calculate_your_monthly_loan_payment_and_total_interest")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <CalculatorInput
              label={t("calculator_loan_principal")}
              name="principal"
              value={inputs.principal}
              onChange={handlePrincipalChange}
              type="currency"
              prefix="$"
              required
              error={errors.principal}
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
              name="term"
              value={inputs.term}
              onChange={handleTermChange}
              suffix={t("calculator_months")}
              required
              min={1}
              error={errors.term}
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
                {t("calculator_calculating")}
              </>
            ) : (
              t("calculator_loan_calculate")
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t("calculator_results")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
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
                  {t("calculator_loan_total_payment")}
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

            {result.amortizationSchedule &&
              result.amortizationSchedule.length > 0 && (
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
                        {paymentSchedulePreview.map(
                          (entry: AmortizationScheduleEntry) => (
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
                                {entry.remainingBalance.toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                  }
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        )}
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
