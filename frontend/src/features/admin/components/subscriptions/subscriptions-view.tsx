/**
 * Subscriptions View Component - Modern SaaS Design
 *
 * Main admin view for subscriptions with list, filters, and analytics.
 */

"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { useApp } from "@/shared/contexts/app-context";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { SubscriptionsList } from "./subscriptions-list";
import { SubscriptionAnalytics } from "./subscription-analytics";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";

interface SubscriptionStats {
  total: number;
  active: number;
  trialing: number;
  canceled: number;
  pastDue: number;
  byTier: {
    basic: number;
    pro: number;
    enterprise: number;
  };
}

export function SubscriptionsView() {
  const { user } = useApp();
  const fetcher = useQueryFetcher<SubscriptionStats>();

  // Admin layout wraps with AuthGuard; user is guaranteed when this renders.
  const { error: profileError, isLoading: loading } = useQuery({
    queryKey: queryKeys.api.admin.subscriptionsAnalytics(),
    queryFn: () => fetcher("/api/admin/subscriptions/analytics"),
    enabled: !!user,
  });

  const error = profileError
    ? profileError instanceof Error
      ? profileError.message
      : "Failed to load subscription statistics"
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          Subscriptions
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage subscriptions and view subscription analytics
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/50">
          <TabsTrigger
            value="list"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Subscription List
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-6">
          <SubscriptionsList />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <SubscriptionAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
