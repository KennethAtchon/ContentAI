import { auth } from "@/shared/services/firebase/config";
import { safeFetch, SafeFetchOptions } from "./safe-fetch";
import { debugLog } from "@/shared/utils/debug";
import { API_URL } from "@/shared/utils/config/envUtil";

const API_BASE_URL = API_URL;

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
} as const;

const DEFAULT_TIMEOUT = 10000; // 10 seconds

// CSRF token cache (only for authenticated users)
let csrfTokenCache: { token: string; expires: Date } | null = null;

/**
 * Gets a valid CSRF token for authenticated users
 */
async function getCSRFToken(): Promise<string> {
  // Return cached token if still valid
  if (csrfTokenCache && csrfTokenCache.expires > new Date()) {
    return csrfTokenCache.token;
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();

  // Log the request details before making the call
  debugLog.info(
    "CSRF token request started",
    { service: "authenticated-fetch" },
    {
      url: `${API_BASE_URL}/api/csrf`,
      method: "GET",
      hasUser: !!user,
      uid: user?.uid,
      hasToken: !!token,
      tokenLength: token?.length,
      cachedToken: !!csrfTokenCache,
      cacheExpires: csrfTokenCache?.expires,
      isCacheValid: csrfTokenCache?.expires
        ? csrfTokenCache.expires > new Date()
        : false,
    }
  );

  const response = await safeFetch(`${API_BASE_URL}/api/csrf`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  // Log response details
  debugLog.info(
    "CSRF token response received",
    { service: "authenticated-fetch" },
    {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    }
  );

  if (!response.ok) {
    // Try to get more error details
    let errorDetails = "";
    try {
      const errorText = await response.text();
      errorDetails = errorText;
      debugLog.error(
        "CSRF token request failed",
        { service: "authenticated-fetch" },
        {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          url: `${API_BASE_URL}/api/csrf`,
        }
      );
    } catch (parseError) {
      debugLog.error(
        "CSRF token request failed (could not parse error body)",
        { service: "authenticated-fetch" },
        {
          status: response.status,
          statusText: response.statusText,
          parseError:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          url: `${API_BASE_URL}/api/csrf`,
        }
      );
    }

    throw new Error(
      `CSRF token request failed: ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ""}`
    );
  }

  const data = await response.json();

  debugLog.info(
    "CSRF token parsed successfully",
    { service: "authenticated-fetch" },
    {
      hasToken: !!data.csrfToken,
      tokenLength: data.csrfToken?.length,
      expires: data.expires,
      cacheExpires: csrfTokenCache?.expires,
    }
  );

  csrfTokenCache = {
    token: data.csrfToken,
    expires: new Date(data.expires),
  };

  return csrfTokenCache.token;
}

/**
 * Clears CSRF token cache
 */
function clearCSRFToken(): void {
  csrfTokenCache = null;
}

/**
 * Checks if request needs CSRF protection
 */
function needsCSRFToken(method: string): boolean {
  const upperMethod = method.toUpperCase();
  return !["GET", "HEAD", "OPTIONS"].includes(upperMethod);
}

/**
 * Authenticated fetch with Firebase token and CSRF protection
 * Uses safeFetch internally for timeout and retry logic
 */
export async function authenticatedFetch(
  url: string,
  requestInit: RequestInit = {}
): Promise<Response> {
  // Construct full URL if relative path provided
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const user = auth.currentUser;

  debugLog.info(
    "Authenticated fetch called",
    { service: "authenticated-fetch" },
    {
      url: fullUrl,
      originalUrl: url,
      method: requestInit.method || "GET",
      hasUser: !!user,
      uid: user?.uid,
      isEmailVerified: user?.emailVerified,
    }
  );

  if (!user) {
    debugLog.error(
      "User not authenticated for authenticated fetch",
      { service: "authenticated-fetch" },
      { url: fullUrl, method: requestInit.method || "GET" }
    );
    throw new Error("User not authenticated");
  }

  // Firebase does not attach tokens to our API calls; we send the token explicitly.
  const idToken = await user.getIdToken();
  const requestHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${idToken}`,
    ...(requestInit.headers as Record<string, string>),
  };

  const method = requestInit.method ?? "GET";
  if (needsCSRFToken(method)) {
    try {
      const csrfToken = await getCSRFToken();
      requestHeaders["X-CSRF-Token"] = csrfToken;

      debugLog.debug(
        "Added CSRF token to request",
        { service: "authenticated-fetch" },
        { method, hasToken: true }
      );
    } catch (error) {
      debugLog.error(
        "Failed to get CSRF token",
        { service: "authenticated-fetch" },
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          url: fullUrl,
          method: requestInit.method || "GET",
          hasUser: !!auth.currentUser,
          uid: auth.currentUser?.uid,
          requestInit: requestInit,
        }
      );
      throw new Error(
        `Failed to get CSRF token: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const mergedRequestInit: RequestInit = {
    ...requestInit,
    headers: requestHeaders,
  };

  /** Full config for safeFetch: caller's request + auth/CSRF headers + behavior options */
  const safeFetchOptions: SafeFetchOptions = {
    ...mergedRequestInit,
    timeout: DEFAULT_TIMEOUT,
    retryAttempts: 2,
    retryOn: (error: Error) => {
      if (
        error.message.includes("not authenticated") ||
        error.message.includes("CSRF token")
      ) {
        return false;
      }
      return true;
    },
    validateResponse: (_response: Response) => true,
    logRequests: true,
  };

  try {
    const response = await safeFetch(fullUrl, safeFetchOptions);

    if (response.status === 403) {
      try {
        const errorData = await response.clone().json();
        if (errorData.code === "CSRF_TOKEN_INVALID") {
          clearCSRFToken();
          throw new Error("CSRF token invalid. Please retry your request.");
        }
      } catch {
        // If we can't parse error, rethrow or continue with original response
      }
    }

    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw err;
  }
}

/**
 * Authenticated fetch with JSON response parsing
 */
export async function authenticatedFetchJson<T = unknown>(
  url: string,
  requestInit: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, requestInit);

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

  const jsonData = await response.json();

  // Auto-unwrap standardized API responses
  if (
    jsonData &&
    typeof jsonData === "object" &&
    "data" in jsonData &&
    Object.keys(jsonData).length <= 2 &&
    (Object.keys(jsonData).length === 1 || "meta" in jsonData)
  ) {
    return jsonData.data as T;
  }

  return jsonData as T;
}
