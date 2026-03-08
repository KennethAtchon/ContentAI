/**
 * Retirement Calculator Component
 *
 * Calculator for retirement readiness and planning.
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
import { RetirementInputs, RetirementResult } from "../types/calculator.types";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Loader2, Target } from "lucide-react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function RetirementCalculator() {
  const { t } = useTranslation();
  const { role } = useSubscription();
  const {
    calculate,
    isLoading,
    error: calcError,
    usageLimitReached,
  } = useCalculator();
  const [inputs, setInputs] = useState<RetirementInputs>({
    currentAge: 0,
    retirementAge: 0,
    currentSavings: 0,
    monthlyContribution: 0,
    annualReturnRate: 0,
    expectedRetirementSpending: 0,
    lifeExpectancy: 85,
  });
  const [result, setResult] = useState<RetirementResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Memoize validation function
  const validateInputs = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (inputs.currentAge <= 0 || inputs.currentAge >= 100) {
      newErrors.currentAge = t("calculator_retirement_error_current_age");
    }
    if (inputs.retirementAge <= inputs.currentAge) {
      newErrors.retirementAge = t("calculator_retirement_error_retirement_age");
    }
    if (inputs.currentSavings < 0) {
      newErrors.currentSavings = t(
        "calculator_retirement_error_current_savings"
      );
    }
    if (inputs.monthlyContribution < 0) {
      newErrors.monthlyContribution = t(
        "calculator_retirement_error_contribution"
      );
    }
    if (inputs.annualReturnRate < 0 || inputs.annualReturnRate > 100) {
      newErrors.annualReturnRate = t("calculator_retirement_error_return_rate");
    }
    if (inputs.expectedRetirementSpending <= 0) {
      newErrors.expectedRetirementSpending = t(
        "calculator_retirement_error_spending"
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inputs, t]);

  // Memoize calculate handler
  const handleCalculate = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    const calculationResult = await calculate("retirement", inputs);
    if (calculationResult) {
      setResult(calculationResult.results as RetirementResult);
    }
  }, [inputs, validateInputs, calculate]);

  // Memoize recommendations list
  const recommendations = useMemo(
    () => result?.recommendations || [],
    [result?.recommendations]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t("common_retirement_calculator")}
          </CardTitle>
          <CardDescription>
            {t(
              "common_calculate_your_retirement_readiness_and_plan_for_your_future"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <CalculatorInput
              label={t("calculator_retirement_current_age")}
              name="currentAge"
              value={inputs.currentAge}
              onChange={(value) => setInputs({ ...inputs, currentAge: value })}
              suffix={t("calculator_years")}
              required
              min={1}
              max={99}
              error={errors.currentAge}
            />
            <CalculatorInput
              label={t("calculator_retirement_retirement_age")}
              name="retirementAge"
              value={inputs.retirementAge}
              onChange={(value) =>
                setInputs({ ...inputs, retirementAge: value })
              }
              suffix={t("calculator_years")}
              required
              min={inputs.currentAge + 1}
              error={errors.retirementAge}
            />
            <CalculatorInput
              label={t("calculator_retirement_current_savings")}
              name="currentSavings"
              value={inputs.currentSavings}
              onChange={(value) =>
                setInputs({ ...inputs, currentSavings: value })
              }
              type="currency"
              prefix="$"
              min={0}
              error={errors.currentSavings}
            />
            <CalculatorInput
              label={t("calculator_investment_monthly_contribution")}
              name="monthlyContribution"
              value={inputs.monthlyContribution}
              onChange={(value) =>
                setInputs({ ...inputs, monthlyContribution: value })
              }
              type="currency"
              prefix="$"
              required
              min={0}
              error={errors.monthlyContribution}
            />
            <CalculatorInput
              label={t("calculator_retirement_annual_return")}
              name="annualReturnRate"
              value={inputs.annualReturnRate}
              onChange={(value) =>
                setInputs({ ...inputs, annualReturnRate: value })
              }
              type="percentage"
              suffix="%"
              required
              min={0}
              max={100}
              error={errors.annualReturnRate}
            />
            <CalculatorInput
              label={t("common_expected_monthly_retirement_spending")}
              name="expectedRetirementSpending"
              value={inputs.expectedRetirementSpending}
              onChange={(value) =>
                setInputs({ ...inputs, expectedRetirementSpending: value })
              }
              type="currency"
              prefix="$"
              required
              min={1}
              error={errors.expectedRetirementSpending}
            />
            <CalculatorInput
              label={t("calculator_retirement_life_expectancy")}
              name="lifeExpectancy"
              value={inputs.lifeExpectancy || 85}
              onChange={(value) =>
                setInputs({ ...inputs, lifeExpectancy: value })
              }
              suffix={t("calculator_years")}
              min={inputs.retirementAge + 1}
              max={120}
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
              t("calculator_retirement_calculate")
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t("calculator_retirement_results")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={result.isOnTrack ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {result.isOnTrack ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <AlertDescription className="font-semibold">
                  {result.isOnTrack
                    ? "You are on track for retirement!"
                    : "You may need to adjust your retirement plan"}
                </AlertDescription>
              </div>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_retirement_savings_at_retirement")}
                </p>
                <p className="text-2xl font-bold">
                  $
                  {result.retirementSavings.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("common_years_in_retirement")}
                </p>
                <p className="text-xl font-semibold">
                  {result.yearsInRetirement} {t("calculator_years")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_retirement_monthly_income")}
                </p>
                <p className="text-xl font-semibold">
                  $
                  {result.monthlyRetirementIncome.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              {result.shortfall && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("calculator_retirement_shortfall")}
                  </p>
                  <p className="text-xl font-semibold text-destructive">
                    $
                    {result.shortfall.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
              {result.surplus && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("calculator_retirement_surplus")}
                  </p>
                  <p className="text-xl font-semibold text-green-600">
                    $
                    {result.surplus.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
            </div>

            {result.recommendations && result.recommendations.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <AlertCircle className="h-5 w-5" />
                  {t("calculator_retirement_recommendations")}
                </h3>
                <ul className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
