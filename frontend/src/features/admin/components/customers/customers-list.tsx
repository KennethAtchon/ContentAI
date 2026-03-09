"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useApp } from "@/shared/contexts/app-context";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { debugLog } from "@/shared/utils/debug";
import { ErrorAlert } from "@/shared/components/custom-ui/error-alert";
import { EmptyState } from "@/shared/components/custom-ui/empty-state";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

import { EditCustomerModal } from "./edit-customer-modal";

// Constants
const COMPONENT_NAME = "CustomersList";
const DEFAULT_AVATAR_IMAGE = "/assets/reelstudio-logo.png";
const STATUS_ACTIVE = "active";
const STATUS_INACTIVE = "inactive";
const MAX_INITIALS_LENGTH = 2;
const TABLE_COLUMN_COUNT = 7;
const LOADING_COLUMN_COUNT = 5;
const ERROR_COLUMN_COUNT = 8;

type CustomerStatus = "active" | "inactive" | string;

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  status?: CustomerStatus;
}

type CustomerFormData = Omit<Customer, "id" | "role">;

interface CustomersListProps {
  limit?: number;
  search?: string;
  selectedUserId?: string | null;
}

interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
  showing: number;
  from: number;
  to: number;
}

interface ApiResponse {
  users: Customer[];
  pagination: PaginationMetadata;
}

/**
 * Generate customer initials from name
 */
function getCustomerInitials(name: string): string {
  if (!name || typeof name !== "string") {
    return "??";
  }

  return name
    .split(" ")
    .map((namePart) => namePart.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, MAX_INITIALS_LENGTH);
}

/**
 * Status badge component for displaying customer status
 */
function StatusBadge({
  status,
  t,
}: {
  status: CustomerStatus;
  t: (key: string) => string;
}) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === STATUS_ACTIVE) {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-600">
        {t("common_active")}
      </Badge>
    );
  }

  if (normalizedStatus === STATUS_INACTIVE) {
    return (
      <Badge variant="outline" className="text-slate-600 border-slate-600">
        {t("admin_customers_inactive")}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

/**
 * Customers list component that displays customer data in a table format
 * with search and filtering capabilities
 */
export function CustomersList({
  limit,
  search,
  selectedUserId,
}: CustomersListProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher<ApiResponse>();

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState<CustomerFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    status: "",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageLimit = limit || 20;

  const customersUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: pageLimit.toString(),
    });

    if (search && search.trim()) {
      params.append("search", search.trim());
    }

    return `/api/users?${params.toString()}`;
  }, [currentPage, pageLimit, search]);

  const {
    data: apiResponse,
    error,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: [
      "api",
      "users",
      "customers",
      { page: currentPage, limit: pageLimit, search: search ?? "" },
    ],
    queryFn: () => fetcher(customersUrl),
    enabled: !!user,
  });

  // Extract customers and pagination from response
  const customers = useMemo(
    () => apiResponse?.users || [],
    [apiResponse?.users]
  );
  const paginationData = apiResponse?.pagination || {
    total: customers.length,
    page: currentPage,
    limit: pageLimit,
    totalPages: Math.ceil(customers.length / pageLimit),
    hasMore: false,
    hasPrevious: currentPage > 1,
    showing: customers.length,
    from: (currentPage - 1) * pageLimit + 1,
    to: (currentPage - 1) * pageLimit + customers.length,
  };

  const pagination = {
    page: paginationData.page,
    limit: paginationData.limit,
    total: paginationData.total,
    totalPages: paginationData.totalPages,
    hasMore: paginationData.hasMore || false,
  };

  // Reset to page 1 when search changes (with debounce)
  useEffect(() => {
    const DEBOUNCE_DELAY = 1000; // 1 second debounce
    const handler = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when search changes
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(handler);
  }, [search]);

  /**
   * Open edit modal and populate form with customer data
   */
  const handleEditCustomer = useCallback((customer: Customer): void => {
    debugLog.info(
      "Opening customer edit modal",
      { component: COMPONENT_NAME },
      { customerId: customer.id }
    );

    setEditCustomer(customer);
    setEditForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      address: customer.address || "",
      status: customer.status || STATUS_ACTIVE,
    });
    setEditOpen(true);
  }, []);

  // Auto-open edit modal when navigated from subscriptions with a userId
  useEffect(() => {
    if (!selectedUserId || loading || customers.length === 0) return;
    const match = customers.find((c) => c.id === selectedUserId);
    if (match) {
      handleEditCustomer(match);
    }
  }, [selectedUserId, loading, customers, handleEditCustomer]);

  // Display customers as-is from the API response
  const displayCustomers = customers;

  /**
   * Handle page navigation
   */
  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
  };

  /**
   * Handle form input changes
   */
  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = event.target;
    setEditForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  /**
   * Save customer changes via API and update local state
   */
  const handleSaveCustomer = async (): Promise<void> => {
    if (!editCustomer) {
      debugLog.warn("Save attempted without selected customer", {
        component: COMPONENT_NAME,
      });
      return;
    }

    try {
      debugLog.info(
        "Saving customer changes",
        { component: COMPONENT_NAME },
        { customerId: editCustomer.id }
      );

      await authenticatedFetchJson("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editCustomer.id,
          phone: editForm.phone,
          address: editForm.address,
        }),
      });

      // Refetch to get updated data
      await refetch();

      setEditOpen(false);

      debugLog.info(
        "Customer updated successfully",
        { component: COMPONENT_NAME },
        { customerId: editCustomer.id }
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while updating the customer";

      debugLog.error(
        "Failed to update customer",
        { component: COMPONENT_NAME },
        err
      );

      alert(errorMessage);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="px-6">
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && displayCustomers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={LOADING_COLUMN_COUNT}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Users className="h-6 w-6" />
                      <span>Loading customers...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={ERROR_COLUMN_COUNT}
                    className="h-24 text-center"
                  >
                    <ErrorAlert error={error?.message} />
                  </TableCell>
                </TableRow>
              ) : displayCustomers.length > 0 ? (
                displayCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className={(customer as any).isDeleted ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {customer.id}
                        {(customer as any).isDeleted && (
                          <Badge variant="destructive" className="text-xs">
                            DELETED
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={DEFAULT_AVATAR_IMAGE}
                            alt={customer.name}
                          />
                          <AvatarFallback>
                            {getCustomerInitials(customer.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {customer.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.phone || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={customer.status || STATUS_ACTIVE}
                        t={t}
                      />
                    </TableCell>
                    <TableCell>{customer.address || "-"}</TableCell>
                    <TableCell>{customer.role}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">
                              {t("admin_contact_messages_actions")}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="font-bold ">
                            {t("admin_contact_messages_actions")}
                          </DropdownMenuLabel>
                          {/* <DropdownMenuItem className="text-muted-foreground">
                            View profile
                          </DropdownMenuItem> */}
                          <DropdownMenuItem
                            onClick={() => handleEditCustomer(customer)}
                          >
                            {t("common_edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            {t("common_view_orders")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_COLUMN_COUNT}
                    className="h-24 text-center"
                  >
                    <EmptyState
                      icon={Users}
                      title={t("common_no_customers_found")}
                      description={
                        search
                          ? t("common_no_customers_match_your_search_criteria")
                          : t("common_no_customers_found")
                      }
                      variant="minimal"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              {t("common_pagination_showing", {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
                item: t("common_pagination_customers"),
              })}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common_pagination_previous")}
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from(
                  { length: Math.min(5, pagination.totalPages) },
                  (_, i) => {
                    const startPage = Math.max(1, pagination.page - 2);
                    const page = startPage + i;
                    if (page <= pagination.totalPages) {
                      return (
                        <Button
                          key={page}
                          variant={
                            pagination.page === page ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handlePageChange(page)}
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
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasMore}
              >
                {t("common_pagination_next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Customer Modal */}
      <EditCustomerModal
        open={editOpen}
        onOpenChange={setEditOpen}
        form={editForm}
        onFormChange={handleFormChange}
        onSave={handleSaveCustomer}
      />
    </>
  );
}
