"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MoreHorizontal, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { useApp } from "@/app/state/app-context";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { debugLog } from "@/shared/debug";
import { DataTable, type ColumnDef } from "@/shared/ui/data-display/DataTable";
import { queryKeys } from "@/app/query/query-keys";

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";

import { EditCustomerModal } from "./edit-customer-modal";

const DEFAULT_AVATAR_IMAGE = "/assets/reelstudio-logo.png";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  status?: string;
}

type CustomerFormData = Omit<Customer, "id" | "role">;

interface CustomersListProps {
  limit?: number;
  search?: string;
  selectedUserId?: string | null;
}

interface ApiResponse {
  users: Customer[];
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

export function CustomersList({
  limit,
  search,
  selectedUserId,
}: CustomersListProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const fetcher = useQueryFetcher<ApiResponse>();

  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<CustomerFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    status: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const pageLimit = limit ?? 20;

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageLimit),
    });
    if (search?.trim()) params.set("search", search.trim());
    return `/api/users?${params}`;
  }, [currentPage, pageLimit, search]);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.api.admin.customers({
      page: currentPage,
      limit: pageLimit,
      search: search ?? "",
    }),
    queryFn: () => fetcher(url),
    enabled: !!user,
  });

  const customers = data?.users ?? [];
  const pagination = data?.pagination
    ? {
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
        hasMore: data.pagination.hasMore,
      }
    : undefined;

  // Reset to page 1 on search change
  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 1000);
    return () => clearTimeout(id);
  }, [search]);

  const handleEdit = useCallback((customer: Customer) => {
    setEditCustomer(customer);
    setEditForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      status: customer.status ?? "active",
    });
    setEditOpen(true);
  }, []);

  // Auto-open edit modal when navigated from subscriptions with a userId
  useEffect(() => {
    if (!selectedUserId || isLoading || customers.length === 0) return;
    const match = customers.find((c) => c.id === selectedUserId);
    if (match) handleEdit(match);
  }, [selectedUserId, isLoading, customers, handleEdit]);

  const handleSave = async () => {
    if (!editCustomer) return;
    setIsSaving(true);
    try {
      await authenticatedFetchJson("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editCustomer.id,
          phone: editForm.phone,
          address: editForm.address,
        }),
      });
      await refetch();
      setEditOpen(false);
      debugLog.info(
        "Customer updated",
        { component: "CustomersList" },
        { id: editCustomer.id }
      );
    } catch (err) {
      debugLog.error(
        "Failed to update customer",
        { component: "CustomersList" },
        err
      );
      toast.error(t("admin_customers_update_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const columns: ColumnDef<Customer>[] = [
    {
      key: "id",
      header: t("admin_customers_col_id"),
      className: "w-[100px]",
      cell: (row) => row.id,
    },
    {
      key: "customer",
      header: t("admin_customers_col_customer"),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={DEFAULT_AVATAR_IMAGE} alt={row.name} />
            <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-sm text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: t("admin_customers_col_phone"),
      cell: (row) => row.phone ?? "-",
    },
    {
      key: "status",
      header: t("admin_customers_col_status"),
      cell: (row) => {
        const s = (row.status ?? "active").toLowerCase();
        if (s === "active")
          return (
            <Badge className="bg-success hover:bg-success">
              {t("common_active")}
            </Badge>
          );
        if (s === "inactive")
          return (
            <Badge variant="outline">{t("admin_customers_inactive")}</Badge>
          );
        return <Badge variant="secondary">{s}</Badge>;
      },
    },
    {
      key: "address",
      header: t("admin_customers_col_address"),
      cell: (row) => row.address ?? "-",
    },
    {
      key: "role",
      header: t("admin_customers_col_role"),
      cell: (row) => row.role,
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
            <DropdownMenuLabel className="font-bold">
              {t("admin_contact_messages_actions")}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              {t("common_edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t("common_view_orders")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable
        title={t("admin_customers_title")}
        columns={columns}
        data={customers}
        isLoading={isLoading}
        error={error?.message}
        pagination={pagination}
        onPageChange={setCurrentPage}
        emptyIcon={Users}
        emptyMessage={t("common_no_customers_found")}
        emptyDescription={
          search
            ? t("common_no_customers_match_your_search_criteria")
            : undefined
        }
        paginationLabels={{
          previous: t("common_pagination_previous"),
          next: t("common_pagination_next"),
          showing: pagination
            ? t("common_pagination_showing", {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
                item: t("common_pagination_customers"),
              })
            : undefined,
        }}
      />

      <EditCustomerModal
        open={editOpen}
        onOpenChange={setEditOpen}
        form={editForm}
        onFormChange={(e) =>
          setEditForm((f) => ({ ...f, [e.target.name]: e.target.value }))
        }
        onSave={handleSave}
        isSaving={isSaving}
      />
    </>
  );
}
