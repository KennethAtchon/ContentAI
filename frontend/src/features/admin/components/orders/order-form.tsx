"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { debugLog } from "@/shared/utils/debug";
import { invalidateAfterAdminOrderSave } from "@/shared/lib/query-invalidation";

import { Button } from "@/shared/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Check, ChevronDown, Search } from "lucide-react";

import { Order } from "./orders-list";

// Constants
const COMPONENT_NAME = "OrderForm";
const API_ENDPOINTS = {
  USERS: "/api/users",
  ORDERS: "/api/admin/orders",
} as const;

const ORDER_STATUS = {
  PAID: "paid",
  PENDING: "pending",
  CANCELLED: "cancelled",
} as const;

// Error messages are now translated - removed constant

// Placeholders are now translated - removed constant

const FORM_GRID_COLS = "grid-cols-1 gap-6";

type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// Schema will be created inside component to use translations
const createOrderFormSchema = (t: (key: string) => string) =>
  z.object({
    id: z.string().optional(),
    userId: z
      .string()
      .min(1, { message: t("admin_order_form_error_customer_required") }),
    status: z.string(),
  });

type OrderFormValues = z.infer<ReturnType<typeof createOrderFormSchema>>;

interface User {
  id: string;
  name: string;
  email: string;
}

interface StatusOption {
  value: OrderStatus;
  label: string;
}

interface OrderFormProps {
  order?: Order;
  onSubmit?: () => void;
  onClose: () => void;
}

/**
 * Order form component for creating and editing orders
 */
export function OrderForm({ order, onSubmit, onClose }: OrderFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetcher = useQueryFetcher<{ users: User[]; pagination?: unknown }>();

  // Customer search state
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

  const { authenticatedFetchJson } = useAuthenticatedFetch();

  // Status options configuration
  const statusOptions: StatusOption[] = [
    { value: ORDER_STATUS.PAID, label: t("admin_orders_paid") },
    { value: ORDER_STATUS.PENDING, label: t("admin_orders_pending") },
    { value: ORDER_STATUS.CANCELLED, label: t("admin_orders_cancelled") },
  ];

  const usersUrl = useMemo(() => {
    const searchQuery = customerSearchTerm.trim()
      ? `search=${encodeURIComponent(customerSearchTerm.trim())}&`
      : "";
    return `${API_ENDPOINTS.USERS}?${searchQuery}page=1&limit=50`;
  }, [customerSearchTerm]);

  const usersEnabled = (customerSearchOpen || customerSearchTerm.trim()) !== "";

  const { data: usersData, error: usersError } = useQuery({
    queryKey: ["api", "users", "list", usersUrl],
    queryFn: () => fetcher(usersUrl),
    enabled: usersEnabled,
    staleTime: 300,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Extract users from SWR response
  const users = useMemo(() => {
    if (!usersData || !Array.isArray(usersData.users)) {
      return [];
    }
    return usersData.users;
  }, [usersData]);

  // Log errors
  useEffect(() => {
    if (usersError) {
      debugLog.error(
        "Failed to fetch users",
        { component: COMPONENT_NAME },
        usersError
      );
    }
  }, [usersError]);

  /**
   * Get default form values based on existing order or empty state
   */
  const getDefaultValues = (): Partial<OrderFormValues> => ({
    userId: order?.userId || "",
    status: order?.status || ORDER_STATUS.PENDING,
  });

  const defaultValues = getDefaultValues();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(createOrderFormSchema(t)),
    defaultValues,
  });

  /**
   * Handle form submission for creating or updating orders
   */
  const handleSubmit = async (data: OrderFormValues): Promise<void> => {
    const payload: OrderFormValues & { id?: string } = { ...data };
    const isUpdate = Boolean(order?.id);
    const operation = isUpdate ? "update" : "create";

    try {
      debugLog.info(
        `Starting order ${operation}`,
        { component: COMPONENT_NAME },
        { orderId: order?.id, userId: data.userId }
      );

      if (isUpdate && order?.id) {
        payload.id = order.id;
        await authenticatedFetchJson(API_ENDPOINTS.ORDERS, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await authenticatedFetchJson(API_ENDPOINTS.ORDERS, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      debugLog.info(
        `Order ${operation} successful`,
        { component: COMPONENT_NAME },
        { orderId: order?.id }
      );

      void invalidateAfterAdminOrderSave(queryClient);

      // Trigger parent callback if provided
      if (onSubmit) {
        onSubmit();
      }

      onClose();
    } catch (error) {
      debugLog.error(
        `Failed to ${operation} order`,
        { component: COMPONENT_NAME },
        error
      );

      toast.error(t("admin_order_form_error_save"));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {order
            ? t("admin_order_form_edit_title")
            : t("admin_order_form_add_title")}
        </DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6 pt-4"
        >
          <div className={`grid ${FORM_GRID_COLS}`}>
            <FormField<OrderFormValues>
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common_customer_information")}</FormLabel>
                  <Popover
                    open={customerSearchOpen}
                    onOpenChange={setCustomerSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          {field.value
                            ? users.find((user) => user.id === field.value)
                                ?.name +
                              ` (${users.find((user) => user.id === field.value)?.email})`
                            : t("admin_order_form_placeholder_select_customer")}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-full p-0"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                    >
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder={t(
                            "admin_order_form_placeholder_customer_search"
                          )}
                          value={customerSearchTerm}
                          onChange={(e) =>
                            setCustomerSearchTerm(e.target.value)
                          }
                          className="border-0 focus-visible:ring-0 shadow-none"
                        />
                      </div>
                      <div className="max-h-60 overflow-auto">
                        {users.length === 0 && customerSearchTerm ? (
                          <div className="p-3 text-base text-muted-foreground">
                            {t(
                              "common_no_customers_match_your_search_criteria"
                            )}
                          </div>
                        ) : users.length === 0 ? (
                          <div className="p-3 text-base text-muted-foreground">
                            {t("admin_order_form_start_typing")}
                          </div>
                        ) : (
                          users.map((user) => (
                            <div
                              key={user.id}
                              className={`flex items-center px-3 py-2 text-base cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                                field.value === user.id
                                  ? "bg-accent text-accent-foreground"
                                  : ""
                              }`}
                              onClick={() => {
                                field.onChange(user.id);
                                setCustomerSearchOpen(false);
                                setCustomerSearchTerm("");
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  field.value === user.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField<OrderFormValues>
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin_order_form_label_status")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            "admin_order_form_placeholder_select_status"
                          )}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? `${order ? t("common_save") : t("common_submit")}…`
                : order
                  ? t("common_save")
                  : t("common_submit")}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
