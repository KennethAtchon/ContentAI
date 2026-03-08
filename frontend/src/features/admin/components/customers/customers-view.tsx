/**
 * Customers View Component - Modern SaaS Design
 *
 * Customer management view with search and filtering capabilities.
 */

"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

import { CustomersList } from "@/features/admin/components/customers/customers-list";
import { useTranslation } from "react-i18next";

const MAX_SEARCH_WIDTH = "max-w-sm";
const ENTER_KEY = "Enter";

export function CustomersView() {
  const { t } = useTranslation();
  const [listKey, setListKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleSearch = (): void => {
    setSelectedUserId(null);
    setSearchTerm(searchInput);
    setListKey((previousKey) => previousKey + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          {t("metadata_admin_customers_title")}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t("admin_customers_manage_track")}
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`relative flex-1 ${MAX_SEARCH_WIDTH}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("admin_customers_search_placeholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === ENTER_KEY) {
                handleSearch();
              }
            }}
            className="pl-9 h-11"
          />
        </div>
        <Button onClick={handleSearch} className="shadow-sm">
          {t("admin_customers_search")}
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {t("common_all_customers")}
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {t("account_subscription_active")}
          </TabsTrigger>
          <TabsTrigger
            value="inactive"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {t("admin_customers_inactive")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          <CustomersList
            key={listKey}
            search={searchTerm}
            selectedUserId={selectedUserId}
          />
        </TabsContent>
        <TabsContent value="active" className="space-y-4 mt-6">
          <CustomersList
            key={listKey}
            search={searchTerm}
            selectedUserId={selectedUserId}
          />
        </TabsContent>
        <TabsContent value="inactive" className="space-y-4 mt-6">
          <CustomersList
            key={listKey}
            search={searchTerm}
            selectedUserId={selectedUserId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
