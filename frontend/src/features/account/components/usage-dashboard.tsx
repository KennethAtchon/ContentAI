/**
 * Usage Dashboard Component
 *
 * Component for displaying ReelStudio usage statistics, content generation history,
 * and usage trends over time.
 */

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useApp } from "@/shared/contexts/app-context";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  Loader2,
  Download,
  Package,
  ChevronLeft,
  ChevronRight,
  Eye,
  Brain,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "react-i18next";
import { Progress } from "@/shared/components/ui/progress";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { ErrorAlert } from "@/shared/components/custom-ui/error-alert";
import { EmptyState } from "@/shared/components/custom-ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
type ContentType = string;
const getContentShortName = (t: ContentType) => t;

interface UsageStats {
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number | null;
  contentGenerated: number;
  contentGeneratedLimit: number | null;
  queueSize: number;
  queueLimit: number | null;
  resetDate?: string;
}

interface GenerationHistory {
  id: string;
  type: ContentType;
  sourceReel: {
    username: string;
    hook: string;
  };
  prompt: string;
  createdAt: Date;
  generationTime: number;
}

interface GenerationHistoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface GenerationHistoryResponse {
  data: GenerationHistory[];
  pagination: GenerationHistoryPagination;
}

const HISTORY_PAGE_LIMIT = 10;

export function UsageDashboard() {
  const { t } = useTranslation();
  const { user } = useApp();
  const queryClient = useQueryClient();
  const fetcher = useQueryFetcher<UsageStats>();
  const [historyPage, setHistoryPage] = useState(1);

  const historyUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: historyPage.toString(),
      limit: HISTORY_PAGE_LIMIT.toString(),
    });
    return `/api/generation/history?${params.toString()}`;
  }, [historyPage]);

  const historyFetcher = useQueryFetcher<GenerationHistoryResponse>();

  const {
    data: usageStats,
    error: statsError,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => fetcher("/api/customer/usage"),
    enabled: !!user,
  });

  const {
    data: historyResponse,
    error: historyError,
    isLoading: historyLoading,
  } = useQuery({
    queryKey: queryKeys.api.generationHistory({
      page: historyPage,
      limit: HISTORY_PAGE_LIMIT,
    } as any),
    queryFn: () => historyFetcher(historyUrl),
    enabled: !!user,
  });

  const history = historyResponse?.data ?? [];
  const historyPagination = historyResponse?.pagination;

  const handleHistoryPageChange = (page: number): void => {
    setHistoryPage(page);
  };

  const loading = statsLoading || historyLoading;
  const error = statsError || historyError;
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportUsage = async () => {
    if (!user) return;

    try {
      const response = await authenticatedFetchJson<{ url: string }>(
        "/api/customer/export",
        {
          method: "POST",
          body: JSON.stringify({ format: "csv" }),
        }
      );

      if (response.url) {
        window.open(response.url, "_blank");
      }

      // Invalidate usage stats and history cache after export
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.usageStats(),
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "api" &&
          q.queryKey[1] === "generation-history",
      });
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export usage data"
      );
    }
  };

  // Get content type labels from centralized config
  const getContentTypeLabel = (type: ContentType): string => {
    return getContentShortName(type);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        icon={Package}
        title={t("account_usage_authentication_required")}
        description={t("common_please_sign_in_to_view_your_usage_statistics")}
      />
    );
  }

  if (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : t("common_unable_to_load_usage_data");
    return (
      <div className="space-y-6">
        <ErrorAlert error={errorMessage} />
        <EmptyState
          icon={Package}
          title={t("common_unable_to_load_usage_data")}
          description={errorMessage}
          action={{
            label: t("shared_error_boundary_try_again"),
            onClick: () => window.location.reload(),
          }}
        />
      </div>
    );
  }

  if (!usageStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("account_usage_statistics")}</CardTitle>
          <CardDescription>
            {t("account_usage_no_subscription")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const reelsPercentage = usageStats.reelsAnalyzedLimit
    ? Math.round(
        (usageStats.reelsAnalyzed / usageStats.reelsAnalyzedLimit) * 100
      )
    : 0;

  const generationPercentage = usageStats.contentGeneratedLimit
    ? Math.round(
        (usageStats.contentGenerated / usageStats.contentGeneratedLimit) * 100
      )
    : 0;

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />

      {/* Usage Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t("studio_usage_reels_analyzed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.reelsAnalyzed}</div>
            {usageStats?.reelsAnalyzedLimit !== null && (
              <p className="text-xs text-muted-foreground">
                {t("account_usage_of_limit", {
                  limit: usageStats.reelsAnalyzedLimit,
                })}
              </p>
            )}
            <Progress value={reelsPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t("studio_usage_analyses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.reelsAnalyzed}</div>
            {usageStats?.reelsAnalyzedLimit !== null && (
              <p className="text-xs text-muted-foreground">
                {t("studio_usage_daily_limit", {
                  limit: usageStats.reelsAnalyzedLimit,
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("studio_usage_content_generated")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats.contentGenerated}
            </div>
            {usageStats?.contentGeneratedLimit !== null && (
              <p className="text-xs text-muted-foreground">
                {t("account_usage_of_limit", {
                  limit: usageStats.contentGeneratedLimit,
                })}
              </p>
            )}
            <Progress value={generationPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("studio_usage_queue_size")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.queueSize}</div>
            {usageStats?.queueLimit !== null && (
              <p className="text-xs text-muted-foreground">
                {t("account_usage_of_limit", { limit: usageStats.queueLimit })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Limit Warning */}
      {usageStats &&
        usageStats.contentGeneratedLimit !== null &&
        generationPercentage >= 100 && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("studio_usage_generation_limit_reached")}
            </AlertDescription>
          </Alert>
        )}

      {/* Recent Generation History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("studio_usage_recent_generations")}</CardTitle>
              <CardDescription>
                {historyPagination
                  ? t("common_pagination_showing", {
                      page: historyPagination.page,
                      totalPages: historyPagination.totalPages,
                      total: historyPagination.total,
                      item: t("common_pagination_generations"),
                    })
                  : t("studio_usage_your_last_10_generations")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportUsage}
              disabled={!!exportError}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("account_usage_export")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ErrorAlert error={exportError} />
          {(history?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={t("studio_usage_no_generations")}
              description={t("studio_usage_start_generating")}
              variant="minimal"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("studio_usage_type")}</TableHead>
                    <TableHead>{t("studio_usage_source_reel")}</TableHead>
                    <TableHead>{t("admin_contact_messages_date")}</TableHead>
                    <TableHead className="text-right">
                      {t("account_usage_time")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history || []).map((generation) => (
                    <TableRow key={generation.id}>
                      <TableCell className="font-medium">
                        {getContentTypeLabel(generation.type)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium text-sm">
                            @{generation.sourceReel.username}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {generation.sourceReel.hook}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(generation.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {generation.generationTime}ms
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {historyPagination && historyPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-0 py-4 border-t mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t("common_pagination_showing", {
                      page: historyPagination.page,
                      totalPages: historyPagination.totalPages,
                      total: historyPagination.total,
                      item: t("common_pagination_generations"),
                    })}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleHistoryPageChange(historyPagination.page - 1)
                      }
                      disabled={historyPagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("common_pagination_previous")}
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from(
                        {
                          length: Math.min(5, historyPagination.totalPages),
                        },
                        (_, i) => {
                          const startPage = Math.max(
                            1,
                            historyPagination.page - 2
                          );
                          const page = startPage + i;
                          if (page <= historyPagination.totalPages) {
                            return (
                              <Button
                                key={page}
                                variant={
                                  historyPagination.page === page
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => handleHistoryPageChange(page)}
                                className="w-8 h-8 p-0"
                              >
                                {page}
                              </Button>
                            );
                          }
                          return null;
                        }
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleHistoryPageChange(historyPagination.page + 1)
                      }
                      disabled={!historyPagination.hasMore}
                    >
                      {t("common_pagination_next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account_usage_tips")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• {t("studio_usage_tip_analysis")}</p>
          <p>• {t("studio_usage_tip_generation")}</p>
          <p>• {t("studio_usage_tip_queue")}</p>
          <p>• {t("studio_usage_tip_upgrade")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
