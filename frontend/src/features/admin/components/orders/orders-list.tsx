"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MoreHorizontal,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { formatDateWithTimezone } from "@/shared/utils/helpers/date";
import { OrderWithDetails } from "@/shared/types";
import { usePaginatedData } from "@/shared/hooks/use-paginated-data";
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
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";

import { OrderForm } from "./order-form";
import { OrderProductsModal } from "./helper/order-products-modal";

// Constants
const COMPONENT_NAME = "OrdersList";
const API_ENDPOINT = "/api/admin/orders";
const DEFAULT_AVATAR_IMAGE = "/assets/reelstudio-logo.png";
const MAX_INITIALS_LENGTH = 2;
const TABLE_COLUMN_COUNT = 6;

const ORDER_STATUS = {
  PAID: "paid",
  PENDING: "pending",
  CANCELLED: "cancelled",
} as const;

type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// Extended order type for orders list with component-specific fields
export interface Order extends Omit<OrderWithDetails, "totalAmount"> {
  userId: string;
  products?: OrderProduct[];
  totalAmount: string | number; // API returns various formats
}

interface OrderProduct {
  name: string;
  quantity: number;
  price: number;
}

interface OrdersListProps {
  limit?: number;
  searchQuery?: string;
  statusFilter?: string;
  refreshKey?: number;
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

interface OrdersApiResponse {
  orders: Order[];
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
 * Status badge component for displaying order status
 */
function StatusBadge({ status }: { status: OrderStatus | string }) {
  const normalizedStatus = status.toLowerCase() as OrderStatus;

  switch (normalizedStatus) {
    case ORDER_STATUS.PAID:
      return (
        <Badge className="bg-success hover:bg-success">Paid</Badge>
      );
    case ORDER_STATUS.PENDING:
      return (
        <Badge variant="outline" className="text-warning border-warning">
          Pending
        </Badge>
      );
    case ORDER_STATUS.CANCELLED:
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return (
        <Badge variant="secondary">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
  }
}

/**
 * Orders list component that displays order data in a table format
 * with search, filtering, and management capabilities
 */
export function OrdersList({
  limit,
  searchQuery,
  statusFilter,
  refreshKey,
}: OrdersListProps) {
  const { t } = useTranslation();
  // Edit state
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Product viewing modal state
  const [viewProductsOrder, setViewProductsOrder] = useState<Order | null>(
    null
  );
  const [viewProductsOpen, setViewProductsOpen] = useState(false);

  // Build URL with filters - SWR will cache each unique combination
  const urlBuilder = useMemo(
    () => (page: number, pageLimit: number) => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageLimit.toString(),
      });

      // Add search and status filters if provided
      if (searchQuery && searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (statusFilter && statusFilter.trim()) {
        params.append("status", statusFilter.trim());
      }

      return `${API_ENDPOINT}?${params.toString()}`;
    },
    [searchQuery, statusFilter]
  );

  // Fetch orders with pagination using SWR
  const {
    data: orders,
    loading,
    error,
    pagination,
    fetchPage,
    refetch,
  } = usePaginatedData<Order>(urlBuilder, {
    initialLimit: limit || 20,
    serviceName: "orders-list",
    transformResponse: (response: unknown) => {
      const apiResponse = response as OrdersApiResponse;
      // Handle both new format { data, pagination } and old format { orders }
      const orderList = apiResponse.orders || [];
      const paginationData = apiResponse.pagination || {
        total: orderList.length,
        page: 1,
        limit: limit || 20,
        totalPages: Math.ceil(orderList.length / (limit || 20)),
        hasMore: false,
        hasPrevious: false,
        showing: orderList.length,
        from: 1,
        to: orderList.length,
      };

      return {
        data: orderList,
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

  // Refetch when filters change (with debounce)
  useEffect(() => {
    const DEBOUNCE_DELAY = 1000; // 1 second debounce
    const handler = setTimeout(() => {
      fetchPage(1); // Reset to first page when search/filter changes
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(handler);
  }, [searchQuery, statusFilter, refreshKey, limit, fetchPage]);

  // Since we now handle filtering and pagination server-side,
  // we display orders as-is from the API response
  const displayOrders = orders || [];

  /**
   * Handle editing an order
   */
  const handleEditOrder = (order: Order): void => {
    debugLog.info(
      "Opening order edit modal",
      { component: COMPONENT_NAME },
      { orderId: order.id }
    );
    setEditOrder(order);
    setEditOpen(true);
  };

  /**
   * Handle view products modal state change
   */
  const handleViewProductsModalChange = (open: boolean): void => {
    setViewProductsOpen(open);
    if (!open) {
      setViewProductsOrder(null);
    }
  };

  /**
   * Handle edit modal state change
   */
  const handleEditModalChange = (open: boolean): void => {
    setEditOpen(open);
    if (!open) {
      setEditOrder(null);
    }
  };

  /**
   * Handle edit modal close
   */
  const handleEditModalClose = (): void => {
    setEditOpen(false);
    setEditOrder(null);
  };

  /**
   * Handle page navigation
   */
  const handlePageChange = (page: number): void => {
    fetchPage(page);
  };

  return (
    <>
      <Card key={refreshKey}>
        <CardHeader className="px-6">
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_COLUMN_COUNT}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Package className="h-6 w-6 animate-pulse" />
                      <span>Loading orders...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_COLUMN_COUNT}
                    className="h-24 text-center"
                  >
                    <ErrorAlert error={error} />
                  </TableCell>
                </TableRow>
              ) : displayOrders.length > 0 ? (
                displayOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={(order as any).isDeleted ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {order.id}
                        {(order as any).isDeleted && (
                          <Badge variant="destructive" className="text-sm">
                            DELETED
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={order.customer.avatar || DEFAULT_AVATAR_IMAGE}
                            alt={order.customer.name}
                          />
                          <AvatarFallback>
                            {getCustomerInitials(order.customer.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <div className="font-medium">
                            {order.customer.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.customer.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDateWithTimezone(
                        order.createdAt instanceof Date
                          ? order.createdAt.toISOString()
                          : order.createdAt
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {(order as any).orderType || "one_time"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={order.status || ORDER_STATUS.PENDING}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {order.totalAmount}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleEditOrder(order)}
                          >
                            Edit order
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
                      icon={Package}
                      title={t("admin_orders_empty_title")}
                      description={
                        searchQuery || statusFilter
                          ? t("common_no_orders_match_your_current_filters")
                          : t("account_orders_no_orders")
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
            <div className="text-base text-muted-foreground">
              Showing page {pagination.page} of {pagination.totalPages} (
              {pagination.total} total orders)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
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
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <OrderProductsModal
        open={viewProductsOpen}
        onOpenChange={handleViewProductsModalChange}
        order={viewProductsOrder}
      />
      <Dialog open={editOpen} onOpenChange={handleEditModalChange}>
        <DialogContent className="max-w-lg w-full">
          {editOrder && (
            <OrderForm
              order={editOrder}
              onSubmit={() => refetch()}
              onClose={handleEditModalClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
