/**
 * Orders View Component - Modern SaaS Design
 *
 * Orders management view with search, filtering, and creation capabilities.
 */

"use client";

import { useState } from "react";
import { Plus, Search, ShoppingCart } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";

import { OrdersList } from "@/features/admin/components/orders/orders-list";
import { OrderForm } from "@/features/admin/components/orders/order-form";
import { useTranslation } from "react-i18next";

const SEARCH_MAX_WIDTH = "max-w-sm";
const MODAL_MAX_WIDTH = "sm:max-w-[600px]";

type OrderStatusFilter = "all" | "pending" | "paid" | "cancelled";

export function OrdersView() {
  const { t } = useTranslation();

  const STATUS_TABS = [
    { value: "all", label: t("admin_orders_all") },
    { value: "pending", label: t("admin_orders_pending") },
    { value: "paid", label: t("admin_orders_paid") },
    { value: "cancelled", label: t("admin_orders_cancelled") },
  ] as const;
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");

  const handleAddOrderOpen = (): void => {
    setIsAddOrderOpen(true);
  };

  const handleAddOrderClose = (): void => {
    setIsAddOrderOpen(false);
  };

  const handleAddOrderSubmit = (): void => {
    setIsAddOrderOpen(false);
    setOrdersRefreshKey((previousKey) => previousKey + 1);
  };

  const handleStatusFilterChange = (value: string): void => {
    setStatusFilter(value as OrderStatusFilter);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            {t("metadata_admin_orders_title")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t(
              "common_manage_and_track_all_customer_orders_payments_and_transactio"
            )}
          </p>
        </div>
        <Button onClick={handleAddOrderOpen} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("admin_orders_add_order")}
        </Button>
      </div>

      {/* Search */}
      <div className={`relative ${SEARCH_MAX_WIDTH}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("admin_orders_search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Status Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={handleStatusFilterChange}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          <OrdersList
            searchQuery={searchQuery}
            statusFilter={statusFilter === "all" ? undefined : statusFilter}
            refreshKey={ordersRefreshKey}
          />
        </TabsContent>
      </Tabs>

      {/* Add Order Dialog */}
      <Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
        <DialogContent className={MODAL_MAX_WIDTH}>
          <OrderForm
            onSubmit={handleAddOrderSubmit}
            onClose={handleAddOrderClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
