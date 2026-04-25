/**
 * Safe Fetch Wrapper
 * Adds timeout, retry logic, and comprehensive error handling to fetch calls
 * Prevents hanging requests that could crash the application
 */

import { systemLogger } from "@/utils/system/system-logger";
import { reportError } from "@/utils/error-handling/global-error-handler";
import { debugLog } from "@/utils/debug";
import { IS_DEVELOPMENT } from "@/utils/config/envUtil";

// Type definition for HeadersInit
type HeadersInit = string[][] | Record<string, string> | Headers;

export interface SafeFetchOptions extends RequestInit {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  retryOn?: (error: Error) => boolean;
  validateResponse?: (response: Response) => boolean;
  logRequests?: boolean;
}

interface RetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  attempts: 3,
  delay: 1000, // 1 second
  backoffMultiplier: 2,
  maxDelay: 10000, // 10 seconds
};

/**
 * Enhanced fetch with timeout, retry, and error handling
 */
export async function safeFetch(
  url: string,
  safeFetchOptions: SafeFetchOptions = {},
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retryAttempts = 3,
    retryDelay = 1000,
    retryOn = defaultRetryCondition,
    validateResponse = defaultResponseValidator,
    logRequests = true,
    ...rest
  } = safeFetchOptions;

  /** Passed through to native fetch() — method, headers, body, etc. */
  const requestInit: RequestInit = rest;

  const requestId = generateRequestId();
  const startTime = Date.now();

  if (logRequests) {
    debugLog.info(
      "External API request started",
      {
        service: "safe-fetch",
        operation: "request-start",
      },
      {
        requestId,
        url: sanitizeUrl(url),
        method: requestInit.method || "GET",
        timeout,
        retryAttempts,
      },
    );
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retryAttempts) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine signals if one was already provided
      const signal = requestInit.signal
        ? combineAbortSignals([requestInit.signal, controller.signal])
        : controller.signal;

      debugLog.debug("Request Logging", {
        service: "safe-fetch",
        operation: "request-logging",
        url: sanitizeUrl(url),
        method: requestInit.method || "GET",
        signal: signal.aborted,
        timeout: timeout,
        retryAttempts: retryAttempts,
        retryDelay: retryDelay,
        retryOn: retryOn,
        validateResponse: validateResponse,
        logRequests: logRequests,
        requestInit: sanitizeRequestInit(requestInit),
      });

      try {
        const response = await fetch(url, {
          ...requestInit,
          signal,
        });

        clearTimeout(timeoutId);

        // Validate response
        if (!validateResponse(response)) {
          throw new Error(
            `Invalid response: ${response.status} ${response.statusText}`,
          );
        }

        const duration = Date.now() - startTime;

        if (logRequests) {
          debugLog.info(
            "External API request completed",
            {
              service: "safe-fetch",
              operation: "request-success",
            },
            {
              requestId,
              url: sanitizeUrl(url),
              method: requestInit.method || "GET",
              statusCode: response.status,
              duration,
              attempt: attempt + 1,
            },
          );
        }

        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      attempt++;
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      const isTimeout =
        err.name === "AbortError" || err.message.includes("timeout");
      const shouldRetry = attempt < retryAttempts + 1 && retryOn(err);

      // Log attempt failure
      if (logRequests) {
        systemLogger.warn(
          "External API request attempt failed",
          {
            service: "safe-fetch",
            operation: "request-retry",
          },
          {
            requestId,
            url: sanitizeUrl(url),
            method: requestInit.method || "GET",
            attempt,
            maxAttempts: retryAttempts + 1,
            error: err.message,
            isTimeout,
            willRetry: shouldRetry,
          },
        );
      }

      if (!shouldRetry) {
        break;
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(
        retryDelay * Math.pow(2, attempt - 1),
        DEFAULT_RETRY_CONFIG.maxDelay,
      );
      await sleep(delay);
    }
  }

  // All attempts failed
  const duration = Date.now() - startTime;
  const finalError =
    lastError || new Error("All fetch attempts failed with unknown errors");

  const structuredError = reportError(finalError, {
    additionalData: {
      url: sanitizeUrl(url),
      method: requestInit.method || "GET",
      attempts: attempt,
      duration,
    },
  });

  systemLogger.error(
    "External API request failed after all retries",
    {
      service: "safe-fetch",
      operation: "request-failed",
    },
    {
      requestId,
      url: sanitizeUrl(url),
      method: requestInit.method || "GET",
      attempts: attempt,
      duration,
      errorId: structuredError.id,
      error: finalError.message,
    },
  );

  throw finalError;
}

/**
 * Default retry condition - retry on network errors and 5xx responses
 */
function defaultRetryCondition(error: Error): boolean {
  // Retry on network errors
  if (error.name === "TypeError" && error.message.includes("fetch")) {
    return true;
  }

  // Retry on timeout
  if (error.name === "AbortError" || error.message.includes("timeout")) {
    return true;
  }

  // Retry on 5xx server errors (but not 4xx client errors)
  if (
    error.message.includes("500") ||
    error.message.includes("502") ||
    error.message.includes("503") ||
    error.message.includes("504")
  ) {
    return true;
  }

  return false;
}

/**
 * Default response validator - considers 2xx and 3xx as valid
 */
function defaultResponseValidator(response: Response): boolean {
  return response.status < 400;
}

/**
 * Combines multiple AbortSignals into one
 */
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();

  signals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort();
      return;
    }
    signal.addEventListener("abort", onAbort);
  });

  return controller.signal;
}

/**
 * Sanitizes URL for logging (removes sensitive query parameters)
 * In development, returns full URL for easier debugging
 */
function sanitizeUrl(url: string): string {
  // In development, return full URL without redacting
  if (IS_DEVELOPMENT) {
    return url;
  }

  try {
    const urlObj = new URL(url);

    // In production, redact sensitive query parameters
    const sensitiveParams = [
      "key",
      "token",
      "secret",
      "password",
      "auth",
      "api_key",
    ];

    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, "[REDACTED]");
      }
    });

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return a generic placeholder
    return "[URL_PARSE_ERROR]";
  }
}

function sanitizeRequestInit(
  requestInit: RequestInit,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    ...requestInit,
  };

  sanitized.headers = sanitizeHeaders(requestInit.headers);

  if (requestInit.body !== undefined) {
    if (typeof requestInit.body === "string") {
      sanitized.body =
        requestInit.body.length > 500
          ? `[STRING_BODY_${requestInit.body.length}_CHARS]`
          : requestInit.body;
    } else {
      sanitized.body = "[NON_STRING_BODY]";
    }
  }

  return sanitized;
}

function sanitizeHeaders(
  headers: HeadersInit | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;

  let normalized: Headers;

  if (headers instanceof Headers) {
    normalized = headers;
  } else if (Array.isArray(headers)) {
    // Convert string[][] to proper format for Headers constructor
    const properArray = headers.filter(
      (pair) => Array.isArray(pair) && pair.length >= 2,
    ) as [string, string][];
    normalized = new Headers(properArray);
  } else {
    normalized = new Headers(headers);
  }

  const redacted: Record<string, string> = {};
  const sensitiveHeaderPattern =
    /authorization|x-api-key|api-key|token|secret|cookie/i;

  normalized.forEach((value, key) => {
    redacted[key] = sensitiveHeaderPattern.test(key) ? "[REDACTED]" : value;
  });

  return redacted;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a unique request ID for tracking
 */
function generateRequestId(): string {
  return `fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pre-configured fetch for common external services
 */
export const externalServiceFetch = {
  /**
   * Fetch for Stripe API calls
   */
  stripe: (url: string, options: SafeFetchOptions = {}) =>
    safeFetch(url, {
      timeout: 15000, // Stripe can be slow
      retryAttempts: 2,
      ...options,
    }),

  /**
   * Fetch for Zoom API calls
   */
  zoom: (url: string, options: SafeFetchOptions = {}) =>
    safeFetch(url, {
      timeout: 10000,
      retryAttempts: 3,
      ...options,
    }),

  /**
   * Fetch for Firebase API calls
   */
  firebase: (url: string, options: SafeFetchOptions = {}) =>
    safeFetch(url, {
      timeout: 8000,
      retryAttempts: 2,
      ...options,
    }),

  /**
   * Fetch for general external APIs
   */
  general: (url: string, options: SafeFetchOptions = {}) =>
    safeFetch(url, {
      timeout: 5000,
      retryAttempts: 1,
      ...options,
    }),
};

/**
 * Public fetch for unauthenticated requests
 * No CSRF protection (not needed for public endpoints)
 * Uses safeFetch for timeout and retry logic
 */
export async function publicFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return safeFetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    timeout: 10000,
    retryAttempts: 2,
    logRequests: true,
  });
}

/**
 * Public fetch with JSON response parsing
 */
export async function publicFetchJson<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await publicFetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// Export the main functions
export default safeFetch;
