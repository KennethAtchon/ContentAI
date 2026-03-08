import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/shared/services/firebase/config";
import { debugLog } from "@/shared/utils/debug";

/**
 * Stripe checkout line item structure for product purchases.
 */
export interface CheckoutLineItem {
  price_data: {
    /** Currency code (e.g., 'usd') */
    currency: string;
    product_data: {
      /** Product display name */
      name: string;
      /** Product description */
      description: string;
      /** Additional product metadata */
      metadata?: Record<string, any>;
    };
    /** Price in smallest currency unit (cents for USD) */
    unit_amount: number;
  };
  /** Quantity of items */
  quantity: number;
}

/**
 * Configuration data for creating a Stripe checkout session.
 */
export interface CheckoutSessionData {
  /** Checkout mode - typically 'payment' for one-time purchases */
  mode: "payment" | "subscription" | "setup";
  /** Items to be purchased */
  line_items?: CheckoutLineItem[];
  /** Stripe Price ID for subscription checkout */
  price_id?: string;
  /** URL to redirect to on successful payment */
  success_url: string;
  /** URL to redirect to on cancelled payment */
  cancel_url: string;
  /** Whether to automatically calculate tax */
  automatic_tax?: boolean;
  /** Additional session metadata */
  metadata?: Record<string, any>;
  /** Whether to collect shipping address */
  collect_shipping_address?: boolean;
  /** Whether to allow promotion codes */
  allow_promotion_codes?: boolean;
  /** Subscription trial period in days */
  trial_period_days?: number;
}

/**
 * Result of creating a checkout session.
 */
export interface CheckoutResult {
  /** Stripe checkout URL if successful */
  url?: string;
  /** Error if checkout creation failed */
  error?: Error;
}

const DEFAULT_CHECKOUT_TIMEOUT_MS = 30000;
const FIRESTORE_COLLECTION_CUSTOMERS = "customers";
const FIRESTORE_COLLECTION_CHECKOUT_SESSIONS = "checkout_sessions";

/**
 * Creates a Stripe checkout session through Firebase Cloud Functions.
 * Listens for the session URL to be populated by the backend.
 *
 * @param userId User ID for Firestore document path
 * @param sessionData Checkout session configuration
 * @param timeoutMs Maximum wait time for session creation
 * @returns Promise resolving to checkout URL or error
 */
export function createCheckoutSession(
  userId: string,
  sessionData: CheckoutSessionData,
  timeoutMs: number = DEFAULT_CHECKOUT_TIMEOUT_MS
): Promise<CheckoutResult> {
  return new Promise((resolve) => {
    let resolved = false;

    const resolveOnce = (result: CheckoutResult) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Create the checkout session document in Firestore
    addDoc(
      collection(
        db,
        FIRESTORE_COLLECTION_CUSTOMERS,
        userId,
        FIRESTORE_COLLECTION_CHECKOUT_SESSIONS
      ),
      sessionData
    )
      .then((docRef) => {
        // Listen for the Cloud Function to populate the checkout URL
        const unsubscribe = onSnapshot(docRef, (snap) => {
          const data = snap.data();

          if (data?.error) {
            debugLog.error(
              "Checkout session creation failed",
              {
                service: "stripe-checkout",
                operation: "createCheckoutSession",
              },
              { userId, error: data.error }
            );
            unsubscribe();

            // Check for invalid customer ID error
            const errorMessage = data.error.message || "";
            if (
              errorMessage.includes("No such customer") ||
              errorMessage.includes("customer")
            ) {
              resolveOnce({
                error: new Error(
                  "Payment account error detected. Please contact support or try again in a moment. " +
                    "If the issue persists, we'll automatically create a new payment account for you."
                ),
              });
            } else {
              resolveOnce({
                error: new Error(errorMessage || "Checkout session failed"),
              });
            }
            return;
          }

          if (data?.url) {
            debugLog.info(
              "Checkout session created successfully",
              {
                service: "stripe-checkout",
                operation: "createCheckoutSession",
              },
              { userId, url: data.url }
            );
            unsubscribe();
            resolveOnce({ url: data.url });
          }
        });

        // Timeout handling for slow session creation
        setTimeout(() => {
          debugLog.warn(
            "Checkout session creation timeout",
            { service: "stripe-checkout", operation: "createCheckoutSession" },
            { userId, timeoutMs }
          );
          unsubscribe();
          resolveOnce({
            error: new Error(
              "Payment setup is taking too long. Please try again."
            ),
          });
        }, timeoutMs);
      })
      .catch((error) => {
        debugLog.error(
          "Failed to create checkout session document",
          { service: "stripe-checkout", operation: "createCheckoutSession" },
          { userId, error }
        );
        resolveOnce({ error });
      });
  });
}

/**
 * Creates a product checkout session with sensible defaults.
 * Convenience wrapper around createCheckoutSession for product purchases.
 *
 * @param userId User ID for the checkout session
 * @param lineItems Products to purchase
 * @param options Optional checkout configuration overrides
 * @returns Promise resolving to checkout URL or error
 */
export async function createProductCheckout(
  userId: string,
  lineItems: CheckoutLineItem[],
  options: Partial<CheckoutSessionData> = {}
): Promise<CheckoutResult> {
  const sessionData: CheckoutSessionData = {
    mode: "payment",
    line_items: lineItems,
    success_url: `${window.location.origin}/payment/success`,
    cancel_url: `${window.location.origin}/payment/cancel`,
    automatic_tax: false,
    ...options,
  };

  return createCheckoutSession(userId, sessionData);
}

/**
 * Creates a subscription checkout session with sensible defaults.
 * Convenience wrapper around createCheckoutSession for subscription purchases.
 *
 * @param userId User ID for the checkout session
 * @param priceId Stripe Price ID for the subscription
 * @param options Optional checkout configuration overrides
 * @returns Promise resolving to checkout URL or error
 */
export async function createSubscriptionCheckout(
  userId: string,
  priceId: string,
  options: Partial<CheckoutSessionData> = {}
): Promise<CheckoutResult> {
  // Firebase Extension expects 'price' field, not 'price_id'
  // We'll create the session data with 'price' for the Extension
  const sessionData: any = {
    mode: "subscription",
    price: priceId, // Firebase Extension expects 'price', not 'price_id'
    success_url:
      options.success_url ||
      `${window.location.origin}/payment/success?type=subscription`,
    cancel_url:
      options.cancel_url || `${window.location.origin}/payment/cancel`,
    automatic_tax: false,
    allow_promotion_codes: true,
    ...options,
  };

  return createCheckoutSession(userId, sessionData);
}
