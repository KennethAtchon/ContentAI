"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Package } from "lucide-react";

import { formatDateWithTimezone } from "@/shared/lib/date";
import { OrderWithDetails } from "@/shared/types";
import { usePaginatedData } from "@/shared/react/use-paginated-data";
import { DataTable, type ColumnDef } from "@/shared/ui/data-display/DataTable";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/primitives/avatar";
import { Badge } from "@/shared/ui/primitives/badge";
import { Button } from "@/shared/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { Dialog, DialogContent } from "@/shared/ui/primitives/dialog";

import { OrderForm } from "./order-form";
import { OrderProductsModal } from "./helper/order-products-modal";

const DEFAULT_AVATAR_IMAGE = "/assets/reelstudio-logo.png";
const API_ENDPOINT = "/api/admin/orders";

export interface Order extends Omit<OrderWithDetails, "totalAmount"> {
  userId: string;
  products?: { name: string; quantity: number; price: number }[];
  totalAmount: string | number;
}

interface OrdersListProps {
  limit?: number;
  searchQuery?: string;
  statusFilter?: string;
  refreshKey?: number;
}

interface OrdersApiResponse {
  orders: Order[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??"
  );
}

function OrderStatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
  const s = status.toLowerCase();
  if (s === "paid")
    return (
      <Badge className="bg-success hover:bg-success">
        {t("admin_orders_paid")}
      </Badge>
    );
  if (s === "pending")
    return (
      <Badge variant="outline" className="text-warning border-warning">
        {t("admin_orders_pending")}
      </Badge>
    );
  if (s === "cancelled")
    return <Badge variant="destructive">{t("admin_orders_cancelled")}</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

export function OrdersList({
  limit,
  searchQuery,
  statusFilter,
  refreshKey,
}: OrdersListProps) {
  const { t } = useTranslation();

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewProductsOrder, setViewProductsOrder] = useState<Order | null>(
    null
  );
  const [viewProductsOpen, setViewProductsOpen] = useState(false);

  const urlBuilder = useMemo(
    () => (page: number, pageLimit: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageLimit),
      });
      if (searchQuery?.trim()) params.set("search", searchQuery.trim());
      if (statusFilter?.trim()) params.set("status", statusFilter.trim());
      return `${API_ENDPOINT}?${params}`;
    },
    [searchQuery, statusFilter]
  );

  const {
    data: orders,
    loading,
    error,
    pagination,
    fetchPage,
    refetch,
  } = usePaginatedData<Order>(urlBuilder, {
    initialLimit: limit ?? 20,
    serviceName: "orders-list",
    transformResponse: (response: unknown) => {
      const r = response as OrdersApiResponse;
      const list = r.orders ?? [];
      const p = r.pagination ?? {
        total: list.length,
        page: 1,
        limit: limit ?? 20,
        totalPages: 1,
        hasMore: false,
      };
      return {
        data: list,
        pagination: {
          page: p.page,
          limit: p.limit,
          total: p.total,
          totalPages: p.totalPages,
          hasMore: p.hasMore,
        },
      };
    },
  });

  useEffect(() => {
    const id = setTimeout(() => fetchPage(1), 1000);
    return () => clearTimeout(id);
  }, [searchQuery, statusFilter, refreshKey, limit, fetchPage]);

  const columns: ColumnDef<Order>[] = [
    {
      key: "id",
      header: t("admin_orders_col_id"),
      className: "w-[100px]",
      cell: (row) => <span className="font-medium">{row.id}</span>,
    },
    {
      key: "customer",
      header: t("admin_orders_col_customer"),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={row.customer.avatar || DEFAULT_AVATAR_IMAGE}
              alt={row.customer.name}
            />
            <AvatarFallback>{getInitials(row.customer.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{row.customer.name}</div>
            <div className="text-sm text-muted-foreground">
              {row.customer.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "date",
      header: t("admin_orders_col_date"),
      cell: (row) =>
        formatDateWithTimezone(
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : row.createdAt
        ),
    },
    {
      key: "type",
      header: t("admin_orders_col_type"),
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {(row as any).orderType ?? "one_time"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: t("admin_orders_col_status"),
      cell: (row) => (
        <OrderStatusBadge status={row.status ?? "pending"} t={t} />
      ),
    },
    {
      key: "total",
      header: t("admin_orders_col_total"),
      className: "text-right",
      cell: (row) => row.totalAmount,
    },
    {
      key: "actions",
      header: "",
      className: "w-[50px]",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">
                {t("admin_contact_messages_actions")}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {t("admin_contact_messages_actions")}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                setEditOrder(row);
                setEditOpen(true);
              }}
            >
              {t("admin_orders_edit")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const paginationState = pagination
    ? {
        page: pagination.page,
        totalPages: pagination.totalPages,
        total: pagination.total,
        hasMore: pagination.hasMore,
      }
    : undefined;

  return (
    <>
      <DataTable
        key={refreshKey}
        title={t("admin_orders_title")}
        columns={columns}
        data={orders ?? []}
        isLoading={loading}
        error={error ?? undefined}
        pagination={paginationState}
        onPageChange={(p) => fetchPage(p)}
        emptyIcon={Package}
        emptyMessage={t("admin_orders_empty_title")}
        emptyDescription={
          searchQuery || statusFilter
            ? t("common_no_orders_match_your_current_filters")
            : t("account_orders_no_orders")
        }
        paginationLabels={{
          previous: t("common_pagination_previous"),
          next: t("common_pagination_next"),
          showing: paginationState
            ? t("common_pagination_showing", {
                page: paginationState.page,
                totalPages: paginationState.totalPages,
                total: paginationState.total,
                item: t("admin_orders_title"),
              })
            : undefined,
        }}
      />

      <OrderProductsModal
        open={viewProductsOpen}
        onOpenChange={(open) => {
          setViewProductsOpen(open);
          if (!open) setViewProductsOrder(null);
        }}
        order={viewProductsOrder}
      />

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditOrder(null);
        }}
      >
        <DialogContent className="max-w-lg w-full">
          {editOrder && (
            <OrderForm
              order={editOrder}
              onSubmit={() => refetch()}
              onClose={() => {
                setEditOpen(false);
                setEditOrder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
