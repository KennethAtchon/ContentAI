/**
 * Investment Calculator Component
 *
 * Calculator for investment future value with compound interest.
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
import { InvestmentInputs, InvestmentResult } from "../types/calculator.types";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Loader2, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function InvestmentCalculator() {
  const { t } = useTranslation();
  const { role } = useSubscription();
  const {
    calculate,
    isLoading,
    error: calcError,
    usageLimitReached,
  } = useCalculator();
  const [inputs, setInputs] = useState<InvestmentInputs>({
    initialInvestment: 0,
    monthlyContribution: 0,
    annualInterestRate: 0,
    years: 0,
    compoundFrequency: 12,
  });
  const [result, setResult] = useState<InvestmentResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Memoize validation function
  const validateInputs = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (inputs.initialInvestment < 0) {
      newErrors.initialInvestment = t("calculator_investment_error_initial");
    }
    if (inputs.monthlyContribution && inputs.monthlyContribution < 0) {
      newErrors.monthlyContribution = t(
        "calculator_investment_error_contribution"
      );
    }
    if (inputs.annualInterestRate < 0 || inputs.annualInterestRate > 100) {
      newErrors.annualInterestRate = t(
        "calculator_mortgage_error_interest_rate"
      );
    }
    if (inputs.years <= 0) {
      newErrors.years = t("calculator_investment_error_period");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inputs, t]);

  // Memoize calculate handler
  const handleCalculate = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    const calculationResult = await calculate("investment", inputs);
    if (calculationResult) {
      setResult(calculationResult.results as InvestmentResult);
    }
  }, [inputs, validateInputs, calculate]);

  // Memoize chart data transformation
  const chartData = useMemo(
    () =>
      result?.growthChart?.map((entry) => ({
        year: entry.year,
        value: entry.value,
        contributions: entry.contributions,
        interest: entry.interest,
      })) || [],
    [result?.growthChart]
  );

  // Memoize input change handlers
  const handleInitialInvestmentChange = useCallback(
    (value: number) =>
      setInputs((prev) => ({ ...prev, initialInvestment: value })),
    []
  );

  const handleMonthlyContributionChange = useCallback(
    (value: number) =>
      setInputs((prev) => ({ ...prev, monthlyContribution: value })),
    []
  );

  const handleAnnualInterestRateChange = useCallback(
    (value: number) =>
      setInputs((prev) => ({ ...prev, annualInterestRate: value })),
    []
  );

  const handleYearsChange = useCallback(
    (value: number) => setInputs((prev) => ({ ...prev, years: value })),
    []
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("home_features_investment_title")}
          </CardTitle>
          <CardDescription>
            {t("calculator_investment_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <CalculatorInput
              label={t("calculator_investment_initial")}
              name="initialInvestment"
              value={inputs.initialInvestment}
              onChange={handleInitialInvestmentChange}
              type="currency"
              prefix="$"
              min={0}
              error={errors.initialInvestment}
            />
            <CalculatorInput
              label={t("calculator_investment_monthly_contribution")}
              name="monthlyContribution"
              value={inputs.monthlyContribution || 0}
              onChange={handleMonthlyContributionChange}
              type="currency"
              prefix="$"
              min={0}
              error={errors.monthlyContribution}
            />
            <CalculatorInput
              label={t("calculator_investment_annual_rate")}
              name="annualInterestRate"
              value={inputs.annualInterestRate}
              onChange={handleAnnualInterestRateChange}
              type="percentage"
              suffix="%"
              required
              min={0}
              max={100}
              error={errors.annualInterestRate}
            />
            <CalculatorInput
              label={t("calculator_investment_period")}
              name="years"
              value={inputs.years}
              onChange={handleYearsChange}
              suffix={t("calculator_years")}
              required
              min={1}
              max={100}
              error={errors.years}
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
              t("calculator_investment_calculate")
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
                  {t("calculator_investment_future_value")}
                </p>
                <p className="text-2xl font-bold">
                  $
                  {result.futureValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_investment_total_contributions")}
                </p>
                <p className="text-xl font-semibold">
                  $
                  {result.totalContributions.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("calculator_investment_total_interest")}
                </p>
                <p className="text-xl font-semibold text-green-600">
                  $
                  {result.totalInterest.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-4 text-lg font-semibold">
                  {t("calculator_investment_growth_chart")}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number | undefined) =>
                        value !== undefined
                          ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : ""
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8884d8"
                      name="Total Value"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="contributions"
                      stroke="#82ca9d"
                      name="Contributions"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
