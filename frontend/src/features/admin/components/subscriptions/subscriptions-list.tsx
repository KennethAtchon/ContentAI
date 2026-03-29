"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Package, Search, Copy, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { usePaginatedData, type PaginationInfo } from "@/shared/hooks/use-paginated-data";
import { DataTable, type ColumnDef } from "@/shared/components/data-display/DataTable";
import { Subscription } from "@/features/subscriptions/types/subscription.types";

const API_ENDPOINT = "/api/admin/subscriptions";

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

function SubscriptionStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "active") return <Badge className="capitalize">{s}</Badge>;
  if (s === "trialing") return <Badge variant="secondary" className="capitalize">{s}</Badge>;
  if (s === "past_due") return <Badge variant="destructive" className="capitalize">{s}</Badge>;
  if (s === "canceled") return <Badge variant="outline" className="capitalize">{s}</Badge>;
  return <Badge variant="secondary" className="capitalize">{s}</Badge>;
}

export function SubscriptionsList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  const urlBuilder = useMemo(
    () => (page: number, limit: number) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tierFilter !== "all") params.set("tier", tierFilter);
      return `${API_ENDPOINT}?${params}`;
    },
    [statusFilter, tierFilter]
  );

  const { data, loading, error, pagination, fetchPage } = usePaginatedData<Subscription>(urlBuilder, {
    initialLimit: 20,
    serviceName: "subscriptions-list",
    transformResponse: (response: unknown) => {
      const r = response as { subscriptions: Subscription[]; pagination: PaginationInfo };
      const list = Array.isArray(r.subscriptions) ? r.subscriptions : [];
      const p = r.pagination ?? { total: list.length, page: 1, limit: 20, totalPages: 1, hasMore: false };
      return { data: list, pagination: { page: p.page, limit: p.limit, total: p.total, totalPages: p.totalPages, hasMore: p.hasMore } };
    },
  });

  useEffect(() => {
    fetchPage(1);
  }, [statusFilter, tierFilter, fetchPage]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const q = searchTerm.toLowerCase();
    return data.filter((s) => s.userId.toLowerCase().includes(q) || s.tier.toLowerCase().includes(q));
  }, [data, searchTerm]);

  const columns: ColumnDef<Subscription>[] = [
    {
      key: "userId",
      header: t("admin_subscriptions_col_user_id"),
      cell: (row) => <UserIdCell userId={row.userId} />,
    },
    {
      key: "tier",
      header: t("admin_subscriptions_col_tier"),
      cell: (row) => <Badge variant="outline" className="capitalize">{row.tier}</Badge>,
    },
    {
      key: "status",
      header: t("admin_subscriptions_col_status"),
      cell: (row) => <SubscriptionStatusBadge status={row.status} />,
    },
    {
      key: "usage",
      header: t("admin_subscriptions_col_usage"),
      cell: (row) =>
        row.usageLimit === null
          ? <span className="text-muted-foreground">{t("admin_subscriptions_usage_unlimited")}</span>
          : `${row.usageCount} / ${row.usageLimit}`,
    },
    {
      key: "period",
      header: t("admin_subscriptions_col_period"),
      className: "text-muted-foreground",
      cell: (row) =>
        row.currentPeriodStart && row.currentPeriodEnd
          ? `${new Date(row.currentPeriodStart).toLocaleDateString()} - ${new Date(row.currentPeriodEnd).toLocaleDateString()}`
          : "N/A",
    },
    {
      key: "actions",
      header: "",
      className: "w-[120px]",
      cell: (row) => (
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/customers" search={{ userId: row.userId } as any}>
            {t("admin_subscriptions_view_customer")}
          </Link>
        </Button>
      ),
    },
  ];

  const paginationState = pagination
    ? { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total, hasMore: pagination.hasMore }
    : undefined;

  const filters = (
    <div className="flex flex-wrap items-end gap-4">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("admin_subscriptions_placeholder_search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10"
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px] h-10">
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
      <Select value={tierFilter} onValueChange={setTierFilter}>
        <SelectTrigger className="w-[150px] h-10">
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
  );

  return (
    <DataTable
      title={t("metadata_admin_subscriptions_title")}
      columns={columns}
      data={filteredData}
      isLoading={loading}
      error={error ?? undefined}
      pagination={paginationState}
      onPageChange={fetchPage}
      filters={filters}
      emptyIcon={Package}
      emptyMessage={t("admin_subscriptions_empty_title")}
      emptyDescription={t("admin_subscriptions_empty_description")}
      paginationLabels={{
        previous: t("common_pagination_previous"),
        next: t("common_pagination_next"),
        showing: paginationState
          ? t("common_pagination_showing", { page: paginationState.page, totalPages: paginationState.totalPages, total: paginationState.total, item: t("common_pagination_subscriptions") })
          : undefined,
      }}
    />
  );
}
