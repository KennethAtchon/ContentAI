/**
 * Usage Dashboard Component
 *
 * Component for displaying ReelStudio usage statistics, content generation history,
 * and usage trends over time.
 */

import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import {
  Loader2,
  Download,
  Package,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Progress } from "@/shared/ui/primitives/progress";
import { Alert, AlertDescription } from "@/shared/ui/primitives/alert";
import { ErrorAlert } from "@/shared/ui/feedback/error-alert";
import { EmptyState } from "@/shared/ui/data-display/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/primitives/table";
import {
  formatGenerationTime,
  useUsageDashboard,
} from "../hooks/use-usage-dashboard";

export function UsageDashboard() {
  const { t, i18n } = useTranslation();
  const {
    error,
    exportError,
    generationPercentage,
    getContentTypeLabel,
    handleExportUsage,
    handleHistoryPageChange,
    history,
    historyPagination,
    isUnlimited,
    loading,
    reelsPercentage,
    usageStats,
    user,
  } = useUsageDashboard();

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

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />

      {/* Usage Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t("studio_usage_reels_analyzed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{usageStats.reelsAnalyzed}</div>
            <p className="text-sm text-muted-foreground">
              {isUnlimited(usageStats.reelsAnalyzedLimit)
                ? t("account_subscription_unlimited_calculations_feature")
                : t("account_usage_of_limit", {
                    limit: usageStats.reelsAnalyzedLimit,
                  })}
            </p>
            {!isUnlimited(usageStats.reelsAnalyzedLimit) && (
              <Progress value={reelsPercentage} className="mt-2 h-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("studio_usage_content_generated")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {usageStats.contentGenerated}
            </div>
            <p className="text-sm text-muted-foreground">
              {isUnlimited(usageStats.contentGeneratedLimit)
                ? t("account_subscription_unlimited_calculations_feature")
                : t("account_usage_of_limit", {
                    limit: usageStats.contentGeneratedLimit,
                  })}
            </p>
            {!isUnlimited(usageStats.contentGeneratedLimit) && (
              <Progress value={generationPercentage} className="mt-2 h-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("studio_usage_queue_size")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{usageStats.queueSize}</div>
            <p className="text-sm text-muted-foreground">
              {isUnlimited(usageStats.queueLimit)
                ? t("account_subscription_unlimited_calculations_feature")
                : t("account_usage_of_limit", { limit: usageStats.queueLimit })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Limit Warning */}
      {usageStats &&
        !isUnlimited(usageStats.contentGeneratedLimit) &&
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
                          <div className="font-medium text-base">
                            @{generation.sourceReel.username}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {generation.sourceReel.hook}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(generation.createdAt).toLocaleDateString(
                          i18n.language,
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
                        {formatGenerationTime(generation.generationTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {historyPagination && historyPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-0 py-4 border-t mt-4">
                  <div className="text-base text-muted-foreground">
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
    </div>
  );
}
