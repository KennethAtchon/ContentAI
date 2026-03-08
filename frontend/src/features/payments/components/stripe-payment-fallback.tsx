"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  startTransition,
} from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CreditCard, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  PaymentService,
  RequiredCustomerData,
} from "@/features/payments/services/payment-service";
import { CheckoutLineItem } from "@/features/payments/services/stripe-checkout";
import { debugLog } from "@/shared/utils/debug";
import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";
import { useTranslation } from "react-i18next";

// Constants
const COMPONENT_NAME = "StripePaymentFallback";

const TIMEOUTS = {
  therapyLoad: 30000, // 30 seconds
  paymentProcess: 60000, // 60 seconds
  redirectDelay: 2000, // 2 seconds
} as const;

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 2000, // 2 seconds
} as const;

const PATHS = {
  success: "/payment/success",
  cancel: "/payment/cancel",
  checkout: "/checkout",
} as const;

// Translation keys are now used via useTranslations hook
// Removed LABELS constant - all strings are now translated

const VALIDATION = {
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  zipRegex: /^\d{5}(-\d{4})?$/,
  requiredFields: ["name", "email", "address", "city", "state", "zip"],
  pollInterval: 100,
} as const;

interface StripePaymentConfig {
  successUrl: string;
  cancelUrl: string;
}

interface ErrorState {
  message: string;
  type: "validation" | "network" | "timeout" | "payment" | "unknown";
  retryable: boolean;
  details?: string;
}

interface ValidOrderData extends RequiredCustomerData {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  contactMethod?: string;
}

export default function StripePaymentFallback() {
  debugLog.debug("StripePaymentFallback component mounted", {
    component: COMPONENT_NAME,
  });

  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const { isAuthenticated, userId } = { isAuthenticated: true, userId: null }; // Simplified for SaaS

  // Enhanced state management
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>(
    t("payment_fallback_initializing")
  );

  // Refs for cleanup and timeout management
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());
  const isUnmountedRef = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    // Copy ref value to variable inside effect for cleanup function
    const timeoutsRef = timeoutRefs;
    return () => {
      isUnmountedRef.current = true;
      const timeouts = timeoutsRef.current;
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // Stripe payment configuration with rules - moved outside component or memoized
  const paymentConfig: StripePaymentConfig = useMemo(() => {
    debugLog.debug("Creating payment config", { component: COMPONENT_NAME });
    return {
      successUrl: `${window.location.origin}${PATHS.success}`,
      cancelUrl: `${window.location.origin}${PATHS.cancel}`,
    };
  }, []);

  // Utility function for setting timeouts with cleanup
  const safeSetTimeout = useCallback(
    (callback: () => void, delay: number): NodeJS.Timeout => {
      const timeout = setTimeout(() => {
        if (!isUnmountedRef.current) {
          callback();
        }
        timeoutRefs.current.delete(timeout);
      }, delay);
      timeoutRefs.current.add(timeout);
      return timeout;
    },
    []
  );

  // Order data validation function
  const validateOrderData = useCallback(
    (
      data: any
    ): { isValid: boolean; error?: ErrorState; validData?: ValidOrderData } => {
      debugLog.debug("Validating order data", {
        component: COMPONENT_NAME,
        hasData: !!data,
      });

      if (!data || typeof data !== "object") {
        return {
          isValid: false,
          error: {
            message: t("payment_fallback_error_invalid_order_data"),
            type: "validation",
            retryable: false,
            details: "Order data is missing or not an object",
          },
        };
      }

      const missingFields = VALIDATION.requiredFields.filter(
        (field) =>
          !data[field] ||
          typeof data[field] !== "string" ||
          data[field].trim() === ""
      );

      if (missingFields.length > 0) {
        return {
          isValid: false,
          error: {
            message: t("payment_fallback_error_missing_customer_info"),
            type: "validation",
            retryable: false,
            details: `${t("payment_fallback_validation_missing_fields")} ${missingFields.join(", ")}`,
          },
        };
      }

      // Email validation
      if (!VALIDATION.emailRegex.test(data.email)) {
        return {
          isValid: false,
          error: {
            message: t("payment_fallback_error_invalid_email"),
            type: "validation",
            retryable: false,
            details: `${t("payment_fallback_validation_invalid_email")} ${data.email}`,
          },
        };
      }

      // ZIP code validation (basic US ZIP)
      if (!VALIDATION.zipRegex.test(data.zip)) {
        return {
          isValid: false,
          error: {
            message: t("payment_fallback_error_invalid_zip"),
            type: "validation",
            retryable: false,
            details: `${t("payment_fallback_validation_invalid_zip")} ${data.zip}`,
          },
        };
      }

      return {
        isValid: true,
        validData: {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim() || undefined,
          address: data.address.trim(),
          city: data.city.trim(),
          state: data.state.trim(),
          zip: data.zip.trim(),
          notes: data.notes?.trim() || undefined,
          contactMethod: data.contactMethod?.trim() || undefined,
        } as ValidOrderData,
      };
    },
    [t]
  );

  // Enhanced error handling function
  const handleError = useCallback(
    (error: unknown, context: string): ErrorState => {
      debugLog.error(`Error in ${context}`, {
        component: COMPONENT_NAME,
        error,
      });

      if (error instanceof Error) {
        // Network errors
        if (
          error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("NetworkError")
        ) {
          return {
            message: t("payment_fallback_error_network"),
            type: "network",
            retryable: true,
            details: error.message,
          };
        }

        // Timeout errors
        if (
          error.message.includes("timeout") ||
          error.message.includes("Timeout")
        ) {
          return {
            message: t("payment_fallback_error_timeout"),
            type: "timeout",
            retryable: true,
            details: error.message,
          };
        }

        // Payment-specific errors
        if (error.message.includes("Product not found")) {
          return {
            message: t("payment_fallback_error_unavailable_items"),
            type: "validation",
            retryable: false,
            details: error.message,
          };
        }

        // Stripe/Payment errors
        if (
          error.message.includes("stripe") ||
          error.message.includes("payment") ||
          error.message.includes("checkout")
        ) {
          return {
            message: t("payment_fallback_error_payment_service"),
            type: "payment",
            retryable: true,
            details: error.message,
          };
        }

        return {
          message: error.message,
          type: "unknown",
          retryable: true,
          details: error.stack,
        };
      }

      return {
        message: t("payment_fallback_error_unexpected"),
        type: "unknown",
        retryable: true,
        details: String(error),
      };
    },
    [t]
  );

  // Retry mechanism with exponential backoff
  const retryWithBackoff = useCallback(
    async (
      operation: () => Promise<any>,
      context: string,
      maxAttempts: number = RETRY_CONFIG.maxAttempts
    ): Promise<any> => {
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          setRetryCount(attempt - 1);
          if (attempt > 1) {
            setIsRetrying(true);
            setProcessingStage(
              `${t("payment_fallback_retrying_payment")} (${t("payment_fallback_validation_attempt")} ${attempt} ${t("payment_fallback_validation_of")} ${maxAttempts})`
            );
          }

          const result = await operation();
          setIsRetrying(false);
          return result;
        } catch (error) {
          lastError = error;
          debugLog.warn(`${context} attempt ${attempt}/${maxAttempts} failed`, {
            component: COMPONENT_NAME,
            error,
          });

          if (attempt < maxAttempts) {
            const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            await new Promise((resolve) =>
              safeSetTimeout(() => resolve(undefined), delay)
            );
          }
        }
      }

      setIsRetrying(false);
      throw lastError;
    },
    [safeSetTimeout, t]
  );

  // Simplified for SaaS - no products, create empty line items
  const createLineItems = useCallback((): CheckoutLineItem[] => {
    // SaaS model - return empty array or create a single service line item if needed
    return [];
  }, []);

  const waitForTherapiesToLoad = useCallback((): Promise<void> => {
    return Promise.resolve();
  }, []);

  // Enhanced payment processing with comprehensive error handling
  const processPayment = useCallback(
    async (validOrderData: ValidOrderData): Promise<void> => {
      return retryWithBackoff(async () => {
        setProcessingStage(t("payment_fallback_waiting_for_therapies"));
        await waitForTherapiesToLoad();

        setProcessingStage(t("payment_fallback_creating_payment_service"));
        const lineItems = createLineItems();

        if (lineItems.length === 0) {
          throw new Error(t("payment_fallback_error_no_items"));
        }

        const paymentService = new PaymentService(
          userId!,
          lineItems,
          0 // subtotal - SaaS model - no products
        );

        setProcessingStage(t("payment_fallback_processing_payment"));

        // Add timeout for payment processing
        const paymentPromise = paymentService.processPayment(validOrderData, {
          successUrl: paymentConfig.successUrl,
          cancelUrl: paymentConfig.cancelUrl,
          collectShippingAddress: false,
          allowPromotionCodes: false,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          safeSetTimeout(() => {
            reject(
              new Error(
                `${t("payment_fallback_error_payment_timeout")} after ${TIMEOUTS.paymentProcess}ms`
              )
            );
          }, TIMEOUTS.paymentProcess);
        });

        await Promise.race([paymentPromise, timeoutPromise]);

        setProcessingStage(t("payment_fallback_payment_complete"));
      }, "payment processing");
    },
    [
      retryWithBackoff,
      waitForTherapiesToLoad,
      createLineItems,
      userId,
      paymentConfig,
      safeSetTimeout,
      t,
    ]
  );

  // Get order data and immediately start payment process
  useEffect(() => {
    const handleInitialPayment = async (orderDataParam: any) => {
      try {
        // Reset states
        setError(null);
        setRetryCount(0);
        setIsRetrying(false);
        setProcessingStage(t("payment_fallback_validating_order_data"));

        // Validate authentication
        if (!isAuthenticated || !userId) {
          setError({
            message: t("payment_fallback_auth_required"),
            type: "validation",
            retryable: false,
            details: `isAuthenticated: ${isAuthenticated}, userId: ${userId}`,
          });
          return;
        }

        // Validate and parse order data
        const validation = validateOrderData(orderDataParam);
        if (!validation.isValid || !validation.validData) {
          setError(validation.error!);
          return;
        }

        setIsProcessing(true);
        await processPayment(validation.validData);
      } catch (error) {
        const errorState = handleError(error, "handleInitialPayment");
        setError(errorState);
        setIsProcessing(false);
      }
    };

    const formDataParam = searchParams.orderData;
    if (formDataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(formDataParam));
        handleInitialPayment(decoded);
      } catch (parseError) {
        const errorState = handleError(parseError, "parsing order data");
        startTransition(() => {
          setError({
            ...errorState,
            message: t("payment_fallback_invalid_order_format"),
            retryable: false,
          });
        });
      }
    } else {
      startTransition(() => {
        setError({
          message: t("payment_fallback_missing_order_data"),
          type: "validation",
          retryable: false,
          details: "orderData parameter missing from URL",
        });
      });

      safeSetTimeout(() => {
        if (!isUnmountedRef.current) {
          navigate({ to: PATHS.checkout });
        }
      }, TIMEOUTS.redirectDelay);
    }
  }, [
    searchParams,
    isAuthenticated,
    userId,
    validateOrderData,
    processPayment,
    handleError,
    safeSetTimeout,
    navigate,
    t,
  ]);

  // Manual retry function
  const handleRetry = useCallback(() => {
    if (!error?.retryable) return;

    setError(null);
    setRetryCount(0);
    setIsRetrying(false);

    // Re-trigger the effect by forcing a re-run
    const formDataParam = searchParams.orderData;
    if (formDataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(formDataParam));
        const validation = validateOrderData(decoded);
        if (validation.isValid && validation.validData) {
          setIsProcessing(true);
          processPayment(validation.validData);
        }
      } catch (parseError) {
        const errorState = handleError(parseError, "retry parsing order data");
        setError(errorState);
      }
    }
  }, [
    error?.retryable,
    searchParams,
    validateOrderData,
    processPayment,
    handleError,
  ]);

  // Enhanced error display with retry functionality
  if (error) {
    const getErrorIcon = () => {
      switch (error.type) {
        case "network":
          return <AlertCircle className="h-12 w-12 mx-auto text-orange-600" />;
        case "timeout":
          return <AlertCircle className="h-12 w-12 mx-auto text-yellow-600" />;
        case "validation":
          return <AlertCircle className="h-12 w-12 mx-auto text-red-600" />;
        case "payment":
          return <CreditCard className="h-12 w-12 mx-auto text-red-600" />;
        default:
          return <AlertCircle className="h-12 w-12 mx-auto text-red-600" />;
      }
    };

    const getErrorTitle = () => {
      switch (error.type) {
        case "network":
          return t("payment_fallback_connection_error");
        case "timeout":
          return t("payment_fallback_request_timeout");
        case "validation":
          return t("payment_fallback_validation_error");
        case "payment":
          return t("payment_fallback_payment_error");
        default:
          return t("payment_fallback_generic_error");
      }
    };

    return (
      <main className="flex-1 bg-gradient-to-br from-gray-50 to-white py-16 md:py-24">
        <div className="container">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-4">{getErrorIcon()}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {getErrorTitle()}
            </h2>
            <p className="text-gray-600 mb-4">{error.message}</p>

            {/* Show retry count if retrying */}
            {retryCount > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                {t("payment_fallback_validation_attempted")} {retryCount}{" "}
                {retryCount !== 1
                  ? t("payment_fallback_validation_times")
                  : t("payment_fallback_validation_time")}
              </p>
            )}

            {/* Error details for debugging (only in development) */}
            {IS_DEVELOPMENT && error.details && (
              <details className="mb-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer">
                  {t("payment_fallback_validation_debug_details")}
                </summary>
                <pre className="text-xs text-gray-400 mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {error.details}
                </pre>
              </details>
            )}

            <div className="space-y-3">
              {/* Retry button for retryable errors */}
              {error.retryable && !isRetrying && (
                <Button
                  onClick={handleRetry}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  disabled={isProcessing}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("shared_error_boundary_try_again")}
                </Button>
              )}

              {/* Show retry in progress */}
              {isRetrying && (
                <Button
                  disabled
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 opacity-75"
                >
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t("payment_fallback_retrying")}
                </Button>
              )}

              {/* Return to checkout button */}
              <Button
                onClick={() => navigate({ to: PATHS.checkout })}
                variant={error.retryable ? "outline" : "default"}
                className={
                  error.retryable
                    ? ""
                    : "w-full bg-gradient-to-r from-teal-600 to-teal-700"
                }
              >
                {t("payment_fallback_return_to_checkout")}
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Enhanced loading state with progress indicators
  return (
    <main className="flex-1 bg-gradient-to-br from-gray-50 to-white py-16 md:py-24">
      <div className="container">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Loading spinner */}
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            {isRetrying && (
              <div className="absolute -top-1 -right-1">
                <div className="bg-blue-600 text-white rounded-full p-1">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isRetrying
              ? t("payment_fallback_retrying_payment")
              : t("payment_fallback_setting_up_payment")}
          </h2>

          {/* Progress indicator */}
          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">{processingStage}</div>

            {/* Show retry count if applicable */}
            {isRetrying && retryCount > 0 && (
              <div className="text-xs text-blue-600">
                {t("payment_fallback_validation_attempt")} {retryCount + 1}{" "}
                {t("payment_fallback_validation_of")} {RETRY_CONFIG.maxAttempts}
              </div>
            )}
          </div>

          {/* Progress bar (visual representation) */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-gradient-to-r from-teal-600 to-teal-700 h-2 rounded-full transition-all duration-500"
              style={{
                width: isProcessing ? "75%" : "50%",
              }}
            />
          </div>

          {/* Status messages */}
          <div className="text-sm text-gray-500 space-y-1">
            {isProcessing && <p>{t("payment_fallback_securing_payment")}</p>}
            {isRetrying && <p>{t("payment_fallback_reconnecting")}</p>}
          </div>

          {/* Safety notice */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              {t("payment_fallback_security_notice")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
