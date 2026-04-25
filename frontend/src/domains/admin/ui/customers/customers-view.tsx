/**
 * Customers View Component - Modern SaaS Design
 *
 * Customer management view with search and filtering capabilities.
 */

"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/primitives/tabs";

import { CustomersList } from "@/domains/admin/ui/customers/customers-list";
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
