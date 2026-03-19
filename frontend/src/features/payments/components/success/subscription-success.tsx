/**
 * Subscription Success Component
 *
 * Displays success message and next steps for subscription purchases.
 * Used when payment type is 'subscription'.
 */

"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Zap,
  PlaySquare,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";
import { debugLog } from "@/shared/utils/debug";
import { APP_NAME, CORE_FEATURE_PATH } from "@/shared/constants/app.constants";
import { queryKeys } from "@/shared/lib/query-keys";

interface SubscriptionSuccessProps {
  sessionId: string | null;
}

export function SubscriptionSuccess({ sessionId }: SubscriptionSuccessProps) {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  // Mark hasUsedFreeTrial when subscription is successfully created
  useEffect(() => {
    const markTrialUsed = async () => {
      try {
        // Call the current subscription endpoint which will mark hasUsedFreeTrial
        // This ensures the flag is set immediately when subscription is created
        const response = await authenticatedFetch("/api/subscriptions/current");
        if (response.ok) {
          debugLog.info("Marked hasUsedFreeTrial after subscription creation", {
            component: "SubscriptionSuccess",
            sessionId: sessionId?.substring(0, 20),
          });
        }
      } catch (error) {
        // Log but don't show error to user - this is a background operation
        debugLog.error(
          "Failed to mark hasUsedFreeTrial after subscription creation",
          {
            component: "SubscriptionSuccess",
          },
          error
        );
      }
    };

    // Only mark if we have a session ID (indicating successful checkout)
    if (sessionId) {
      markTrialUsed();
    }
  }, [sessionId]);

  // Eagerly invalidate subscription caches and poll for the Stripe role claim.
  // The Firebase Stripe Extension sets custom claims via a webhook which can
  // take up to ~30 seconds after checkout. We poll every 3s until the claim
  // appears so the UI reflects the new plan without a manual refresh.
  useEffect(() => {
    if (!sessionId) return;

    queryClient.invalidateQueries({ queryKey: queryKeys.api.usageStats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.api.reelsUsage() });
    queryClient.invalidateQueries({
      queryKey: queryKeys.api.currentSubscription(),
    });

    const MAX_ATTEMPTS = 20; // 60s max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const user = getAuth().currentUser;
        if (!user) return;

        await user.getIdToken(true); // force-refresh the token
        const result = await user.getIdTokenResult();

        if (result.claims.stripeRole) {
          // Role is now set — invalidate everything and stop polling
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.usageStats(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.reelsUsage(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.api.currentSubscription(),
          });
          clearInterval(interval);
          debugLog.info("Stripe role claim detected, caches invalidated", {
            component: "SubscriptionSuccess",
            attempts,
          });
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(interval);
        }
      } catch (error) {
        debugLog.error(
          "Error polling for Stripe role claim",
          { component: "SubscriptionSuccess" },
          error
        );
        if (attempts >= MAX_ATTEMPTS) clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, queryClient]);

  return (
    <>
      {/* Success Animation */}
      <Card className="border-2 bg-gradient-to-br from-green-500/5 to-primary/5">
        <CardContent className="p-12 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="mb-4 text-5xl font-bold tracking-tight md:text-6xl">
            Welcome to {APP_NAME}!
          </h1>
          <p className="mb-8 text-xl text-muted-foreground">
            Your subscription has been activated successfully. You now have full
            access to all features.
          </p>

          {/* Success Details */}
          <div className="mb-8 space-y-3 rounded-lg border bg-background/50 p-6">
            <div className="flex items-center justify-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">Subscription Active</span>
            </div>
            {sessionId && (
              <p className="text-sm text-muted-foreground">
                Session ID: {sessionId.substring(0, 20)}...
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Button asChild size="lg" className="h-12 shadow-lg">
              <Link to={CORE_FEATURE_PATH}>
                <PlaySquare className="mr-2 h-5 w-5" />
                Start Creating
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-2"
            >
              <Link to="/account">
                <Zap className="mr-2 h-5 w-5" />
                View Account
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="mt-6 border-2">
        <CardContent className="p-6">
          <h2 className="mb-4 text-2xl font-semibold">What's Next?</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-base font-semibold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium">Explore Studio</p>
                <p className="text-base text-muted-foreground">
                  Discover trending hooks, captions, and content inspiration
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-base font-semibold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium">Export Your Content</p>
                <p className="text-base text-muted-foreground">
                  Save your generated reels and export them for publishing
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-base font-semibold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium">Manage Your Subscription</p>
                <p className="text-base text-muted-foreground">
                  View usage, update billing, or change your plan anytime
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
