/**
 * Subscriptions List Component - Modern SaaS Design
 *
 * Displays a list of all subscriptions with filtering and search.
 */

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  usePaginatedData,
  type PaginationInfo,
} from "@/shared/hooks/use-paginated-data";
import { ErrorAlert } from "@/shared/components/custom-ui/error-alert";
import { EmptyState } from "@/shared/components/custom-ui/empty-state";
import { Subscription } from "@/features/subscriptions/types/subscription.types";
import { Search, Package, Loader2, Copy, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

function UserIdCell({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [userId]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span>{userId.substring(0, 8)}...</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-sm">
          {userId}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SubscriptionsList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Build URL with filters - SWR will cache each unique combination
  const urlBuilder = useMemo(
    () => (page: number, limit: number) => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (tierFilter !== "all") params.append("tier", tierFilter);

      return `/api/admin/subscriptions?${params.toString()}`;
    },
    [statusFilter, tierFilter]
  );

  // Fetch subscriptions with pagination using SWR
  const { data, loading, error, pagination, fetchPage } =
    usePaginatedData<Subscription>(urlBuilder, {
      initialLimit: 20,
      serviceName: "subscriptions-list",
      transformResponse: (response: unknown) => {
        const apiResponse = response as {
          subscriptions: Subscription[];
          pagination: PaginationInfo;
        };
        // Response is auto-unwrapped by authenticatedFetchJson
        const subscriptions = Array.isArray(apiResponse.subscriptions)
          ? apiResponse.subscriptions
          : [];
        const paginationData = apiResponse.pagination || {
          total: subscriptions.length,
          page: 1,
          limit: 20,
          totalPages: Math.ceil(subscriptions.length / 20),
          hasMore: false,
        };

        return {
          data: subscriptions,
          pagination: {
            page: paginationData.page,
            limit: paginationData.limit,
            total: paginationData.total,
            totalPages: paginationData.totalPages,
            hasMore: paginationData.hasMore || false,
          },
        };
      },
    });

  // Refetch when filters change
  useEffect(() => {
    fetchPage(1);
  }, [statusFilter, tierFilter, fetchPage]);

  // Client-side search filtering
  const filteredSubscriptions = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.filter((sub) => {
      const matchesSearch =
        sub.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.tier.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [data, searchTerm]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "trialing":
        return "secondary";
      case "past_due":
        return "destructive";
      case "canceled":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (loading && (!Array.isArray(data) || !data.length)) {
    return (
      <Card className="border-2">
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading subscriptions...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-3xl">
              {t("metadata_admin_subscriptions_title")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("metadata_admin_subscriptions_description")}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin_subscriptions_placeholder_search")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2 min-w-[150px]">
            <label className="text-base font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[150px]">
            <label className="text-base font-medium">Tier</label>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ErrorAlert error={error} />

        {/* Table */}
        {filteredSubscriptions.length === 0 && !loading ? (
          <EmptyState
            icon={Package}
            title={t("admin_subscriptions_empty_title")}
            description={t("admin_subscriptions_empty_description")}
            variant="minimal"
          />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">User ID</TableHead>
                  <TableHead className="font-semibold">Tier</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Usage</TableHead>
                  <TableHead className="font-semibold">Period</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((sub) => (
                  <TableRow
                    key={sub.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-medium">
                      <UserIdCell userId={sub.userId} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {sub.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(sub.status)}
                        className="capitalize"
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-base">
                      {sub.usageLimit === null ? (
                        <span className="text-muted-foreground">Unlimited</span>
                      ) : (
                        `${sub.usageCount} / ${sub.usageLimit}`
                      )}
                    </TableCell>
                    <TableCell className="text-base text-muted-foreground">
                      {sub.currentPeriodStart && sub.currentPeriodEnd
                        ? `${new Date(sub.currentPeriodStart).toLocaleDateString()} - ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/admin/customers"
                          search={{ userId: sub.userId } as any}
                        >
                          View Customer
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-base text-muted-foreground">
              Showing page {pagination.page} of {pagination.totalPages} (
              {pagination.total} total)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPage(pagination.page + 1)}
                disabled={!pagination.hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
