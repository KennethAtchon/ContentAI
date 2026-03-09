import { useEffect, useState, startTransition } from "react";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useApp } from "@/shared/contexts/app-context";
import { useTranslation } from "react-i18next";
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  SUBSCRIPTION_TRIAL_DAYS,
} from "@/shared/constants/subscription.constants";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { debugLog } from "@/shared/utils/debug";
import {
  getProductById,
  DEFAULT_PRODUCT,
} from "@/shared/constants/order.constants";
import { SubscriptionCheckout } from "@/features/payments/components/checkout/subscription-checkout";
import { OrderCheckout } from "@/features/payments/components/checkout/order-checkout";
import {
  useSmartRedirect,
  REDIRECT_PATHS,
} from "@/shared/utils/redirect/redirect-util";

interface OrderItem {
  name: string;
  description: string;
  price: number;
  quantity: number;
  productId?: string;
}

export function CheckoutInteractive() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/(customer)/checkout" }) as Record<
    string,
    string | undefined
  >;
  const navigate = useNavigate();
  const { user } = useApp();
  const { redirectToAuth } = useSmartRedirect();
  const subscriptionFetcher = useQueryFetcher<{
    subscription: {
      id: string;
      tier: string;
      billingCycle: "monthly" | "annual" | null;
      status: string;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      isInTrial: boolean;
      trialEnd: string | null;
    } | null;
    tier: string | null;
    billingCycle: "monthly" | "annual" | null;
    isInTrial: boolean;
  }>();
  const trialFetcher = useQueryFetcher<{
    isEligible: boolean;
    hasUsedFreeTrial: boolean;
    isInTrial: boolean;
  }>();
  const [checkoutType, setCheckoutType] = useState<
    "subscription" | "order" | null
  >(null);

  const { data: currentSubscription } = useQuery({
    queryKey: queryKeys.api.currentSubscription(),
    queryFn: () => subscriptionFetcher("/api/subscriptions/current"),
    enabled: !!user,
  });

  const { data: trialEligibilityData } = useQuery({
    queryKey: queryKeys.api.trialEligibility(),
    queryFn: () => trialFetcher("/api/subscriptions/trial-eligibility"),
    enabled: !!user && checkoutType === "subscription",
  });

  const trialEligible = trialEligibilityData?.isEligible ?? false;
  const showTrialBanner = checkoutType === "subscription" && trialEligible;

  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly"
  );

  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      name: DEFAULT_PRODUCT.name,
      description: DEFAULT_PRODUCT.description,
      price: DEFAULT_PRODUCT.price,
      quantity: 1,
      productId: DEFAULT_PRODUCT.id,
    },
  ]);

  useEffect(() => {
    debugLog.info("Checkout useEffect triggered", {
      service: "checkout",
      operation: "useEffect",
      isAuthenticated: !!user,
      searchParams: search,
    });

    if (!user) {
      debugLog.info("No user found, redirecting to auth", {
        service: "checkout",
        operation: "redirectToAuth",
      });
      // Always redirect to sign-up for checkout access with consistent flow
      const currentUrl = window.location.pathname + window.location.search;
      redirectToAuth({
        isSignUp: true,
        returnUrl: currentUrl,
      });
      return;
    }

    const productIdParam = search.product;
    const orderTypeParam = search.type;
    const itemParam = search.item;
    const priceParam = search.price;
    const quantityParam = search.quantity;

    debugLog.info("Processing checkout request", {
      service: "checkout",
      operation: "processRequest",
      currentSubscription,
    });

    if (
      productIdParam ||
      orderTypeParam === "order" ||
      (itemParam && priceParam)
    ) {
      debugLog.info("Processing order checkout", {
        service: "checkout",
        operation: "orderCheckout",
        productIdParam,
        orderTypeParam,
        itemParam,
        priceParam,
      });
      let computedOrderItems: OrderItem[] = [
        {
          name: DEFAULT_PRODUCT.name,
          description: DEFAULT_PRODUCT.description,
          price: DEFAULT_PRODUCT.price,
          quantity: 1,
          productId: DEFAULT_PRODUCT.id,
        },
      ];

      if (productIdParam) {
        const product = getProductById(productIdParam);
        if (product) {
          const parsedQuantity = quantityParam
            ? Number.parseInt(quantityParam, 10)
            : NaN;
          const quantity =
            !Number.isNaN(parsedQuantity) && parsedQuantity > 0
              ? parsedQuantity
              : 1;
          computedOrderItems = [
            {
              name: product.name,
              description: product.description,
              price: product.price,
              quantity,
              productId: product.id,
            },
          ];
        }
      } else if (itemParam && priceParam) {
        const price = Number.parseFloat(priceParam);
        const parsedQuantity = quantityParam
          ? Number.parseInt(quantityParam, 10)
          : NaN;
        const quantity =
          !Number.isNaN(parsedQuantity) && parsedQuantity > 0
            ? parsedQuantity
            : 1;
        if (!Number.isNaN(price) && price > 0) {
          computedOrderItems = [
            {
              name: decodeURIComponent(itemParam),
              description: t("checkout_one_time_purchase"),
              price,
              quantity,
            },
          ];
        }
      }

      startTransition(() => {
        setCheckoutType("order");
        setOrderItems(computedOrderItems);
      });
    } else {
      debugLog.info("Processing subscription checkout", {
        service: "checkout",
        operation: "subscriptionCheckout",
      });
      const tierParam = search.tier as SubscriptionTier | undefined;
      const billingParam = search.billing as "monthly" | "annual" | undefined;

      // Check if user has an active subscription that should redirect to portal
      const hasActiveSubscription =
        currentSubscription?.subscription &&
        (currentSubscription.subscription.status === "active" ||
          currentSubscription.subscription.status === "trialing");

      debugLog.info("Checking subscription status", {
        service: "checkout",
        operation: "checkSubscription",
        hasActiveSubscription,
        subscriptionStatus: currentSubscription?.subscription?.status,
        subscriptionTier: currentSubscription?.tier,
        tierParam,
        billingParam,
      });

      // Only redirect to portal if user has an active subscription AND is trying to purchase the same or lower tier
      if (hasActiveSubscription) {
        const currentTier = currentSubscription.tier;
        const tierHierarchy: Record<string, number> = {
          basic: 1,
          pro: 2,
          enterprise: 3,
        };
        const currentLevel = tierHierarchy[currentTier || "basic"] || 0;
        const requestedLevel = tierHierarchy[tierParam || "basic"] || 0;

        debugLog.info("Comparing subscription tiers", {
          service: "checkout",
          operation: "tierComparison",
          currentTier,
          currentLevel,
          requestedTier: tierParam,
          requestedLevel,
          isUpgrade: requestedLevel > currentLevel,
        });

        if (requestedLevel <= currentLevel) {
          debugLog.info(
            "User purchasing same/lower tier, redirecting to portal",
            {
              service: "checkout",
              operation: "redirectToPortal",
            }
          );
          navigate({
            to: REDIRECT_PATHS.ACCOUNT,
            search: { message: "use-portal" },
          });
          return;
        } else {
          debugLog.info("User upgrading subscription, allowing checkout", {
            service: "checkout",
            operation: "allowUpgrade",
          });
        }
      }

      if (tierParam && Object.values(SUBSCRIPTION_TIERS).includes(tierParam)) {
        debugLog.info("Valid tier provided, setting up subscription checkout", {
          service: "checkout",
          operation: "setupSubscription",
          tier: tierParam,
          billing: billingParam,
        });
        startTransition(() => {
          setCheckoutType("subscription");
          setTier(tierParam);
          if (billingParam === "monthly" || billingParam === "annual") {
            setBillingCycle(billingParam);
          }
        });
      } else {
        debugLog.info("No valid tier, redirecting to pricing", {
          service: "checkout",
          operation: "redirectToPricing",
          tierParam,
        });
        startTransition(() => {
          setCheckoutType("subscription");
        });
        navigate({ to: REDIRECT_PATHS.PRICING });
      }
    }
  }, [search, user, navigate, t, currentSubscription]);

  if (!checkoutType || (checkoutType === "subscription" && !tier)) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link
            to={
              checkoutType === "subscription"
                ? REDIRECT_PATHS.PRICING
                : REDIRECT_PATHS.HOME
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {checkoutType === "subscription"
              ? t("payment_cancel_back_to_pricing")
              : t("checkout_back_to_home")}
          </Link>
        </Button>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {checkoutType === "subscription"
              ? t("checkout_complete_subscription")
              : t("checkout_order_checkout")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {checkoutType === "subscription"
              ? t("checkout_subscription_description")
              : t("checkout_order_description")}
          </p>
        </div>
      </div>

      {showTrialBanner && (
        <Alert className="mb-8 border-2 border-green-500/30 bg-gradient-to-r from-green-500/15 via-emerald-500/15 to-green-500/15 shadow-lg">
          <Sparkles className="h-5 w-5 text-green-600" />
          <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-lg text-foreground mb-1">
                {t("checkout_day_trial", { days: SUBSCRIPTION_TRIAL_DAYS })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "common_try_reelstudio_risk_free"
                )}
              </p>
            </div>
            <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 text-base font-bold shadow-md">
              <Sparkles className="h-4 w-4 mr-2" />
              {t("checkout_first_days_free", { days: SUBSCRIPTION_TRIAL_DAYS })}
            </Badge>
          </AlertDescription>
        </Alert>
      )}

      {checkoutType === "subscription" && tier ? (
        <SubscriptionCheckout
          tier={tier}
          billingCycle={billingCycle}
          onBillingCycleChange={setBillingCycle}
        />
      ) : checkoutType === "order" ? (
        <OrderCheckout initialItems={orderItems} />
      ) : (
        <div>Loading...</div>
      )}
    </>
  );
}
