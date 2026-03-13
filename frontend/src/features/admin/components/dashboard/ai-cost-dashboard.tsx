/**
 * AI Cost Dashboard
 *
 * Shows AI spend totals, breakdowns, and daily trend.
 */

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useApp } from "@/shared/contexts/app-context";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";

interface AiCostsResponse {
  period: string;
  totals: {
    totalCost: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    callCount: number;
  };
  byProvider: Array<{
    provider: string;
    totalCost: string;
    callCount: number;
  }>;
  byModel: Array<{
    provider: string;
    model: string;
    totalCost: string;
    inputTokens: number;
    outputTokens: number;
    callCount: number;
  }>;
  byFeature: Array<{
    featureType: string;
    totalCost: string;
    callCount: number;
  }>;
  byDay: Array<{
    day: string;
    totalCost: string;
    callCount: number;
  }>;
}

const PERIOD = "30d";
const CURRENCY_FORMAT = {
  style: "currency" as const,
  currency: "USD",
  maximumFractionDigits: 6,
};

function parseCost(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatDayLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM d");
}

export function AiCostDashboard() {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher<AiCostsResponse>();

  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.api.admin.aiCosts({ period: PERIOD }),
    queryFn: () => fetcher(`/api/admin/ai-costs?period=${PERIOD}`),
    enabled: !!user,
  });

  const totals = data?.totals;
  const trendData =
    data?.byDay?.map((entry) => ({
      day: formatDayLabel(entry.day),
      totalCost: parseCost(entry.totalCost),
      callCount: entry.callCount,
    })) ?? [];

  const breakdownRows = [
    ...(data?.byProvider ?? []).slice(0, 5).map((row) => ({
      type: t("admin_ai_cost_provider"),
      label: row.provider,
      totalCost: parseCost(row.totalCost),
      callCount: row.callCount,
      inputTokens: null,
      outputTokens: null,
    })),
    ...(data?.byModel ?? []).slice(0, 5).map((row) => ({
      type: t("admin_ai_cost_model"),
      label: `${row.provider} / ${row.model}`,
      totalCost: parseCost(row.totalCost),
      callCount: row.callCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
    })),
    ...(data?.byFeature ?? []).slice(0, 5).map((row) => ({
      type: t("admin_ai_cost_feature"),
      label: row.featureType,
      totalCost: parseCost(row.totalCost),
      callCount: row.callCount,
      inputTokens: null,
      outputTokens: null,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t("admin_ai_cost_title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("admin_ai_cost_description")}
          </p>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {t("admin_ai_cost_period_label")}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("admin_ai_cost_loading")}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : String(error)}
        </div>
      ) : !totals ? (
        <div className="text-sm text-muted-foreground">
          {t("admin_ai_cost_no_data")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("admin_ai_cost_total_spend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {parseCost(totals.totalCost).toLocaleString(
                    "en-US",
                    CURRENCY_FORMAT
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("admin_ai_cost_total_calls")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totals.callCount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("admin_ai_cost_input_tokens")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totals.totalInputTokens.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("admin_ai_cost_output_tokens")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totals.totalOutputTokens.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin_ai_cost_daily_trend")}</CardTitle>
                <CardDescription>
                  {t("admin_ai_cost_daily_trend_description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis
                      tickFormatter={(value: number) =>
                        value.toLocaleString("en-US", {
                          maximumFractionDigits: 4,
                        })
                      }
                    />
                    <Tooltip
                      formatter={(value: any) =>
                        typeof value === "number"
                          ? value.toLocaleString("en-US", CURRENCY_FORMAT)
                          : value
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="totalCost"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin_ai_cost_breakdown_title")}</CardTitle>
                <CardDescription>
                  {t("admin_ai_cost_breakdown_description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">
                        {t("admin_ai_cost_breakdown_type")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("admin_ai_cost_breakdown_item")}
                      </TableHead>
                      <TableHead className="font-semibold text-right">
                        {t("admin_ai_cost_breakdown_cost")}
                      </TableHead>
                      <TableHead className="font-semibold text-right">
                        {t("admin_ai_cost_breakdown_calls")}
                      </TableHead>
                      <TableHead className="font-semibold text-right">
                        {t("admin_ai_cost_breakdown_input_tokens")}
                      </TableHead>
                      <TableHead className="font-semibold text-right">
                        {t("admin_ai_cost_breakdown_output_tokens")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdownRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-sm text-muted-foreground"
                        >
                          {t("admin_ai_cost_no_data")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      breakdownRows.map((row, index) => (
                        <TableRow key={`${row.type}-${row.label}-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.type}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.label}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.totalCost.toLocaleString(
                              "en-US",
                              CURRENCY_FORMAT
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.callCount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.inputTokens === null
                              ? "—"
                              : row.inputTokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.outputTokens === null
                              ? "—"
                              : row.outputTokens.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
