/**
 * Server-side Authenticated Fetch
 *
 * Wraps the standard `fetch` API with Firebase Admin credentials for
 * making authenticated requests to Firebase Cloud Functions or other
 * internal services that require a Firebase ID token.
 *
 * Unlike the frontend's authenticated-fetch (which uses the signed-in user's
 * token), this uses a short-lived custom token minted by Firebase Admin so
 * the backend itself can call Cloud Functions as an authorized caller.
 */

import { adminAuth } from "../firebase/admin";

interface FetchOptions extends RequestInit {
  /** Additional headers merged with the Authorization header */
  headers?: Record<string, string>;
  /** Timeout in milliseconds. Defaults to 10000 (10s). */
  timeoutMs?: number;
}

/**
 * Makes an authenticated HTTP request using a Firebase custom token.
 * Intended for server-to-server calls to Firebase Cloud Functions.
 */
export async function authenticatedFetch(
  url: string,
  uid: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 10_000, headers = {}, ...rest } = options;

  const customToken = await adminAuth.createCustomToken(uid);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        Authorization: `Bearer ${customToken}`,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Same as `authenticatedFetch` but parses the response as JSON.
 * Throws if the response is not ok.
 */
export async function authenticatedFetchJson<T>(
  url: string,
  uid: string,
  options: FetchOptions = {},
): Promise<T> {
  const res = await authenticatedFetch(url, uid, options);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `authenticatedFetch ${options.method ?? "GET"} ${url} → ${res.status}: ${body}`,
    );
  }

  return res.json() as Promise<T>;
}
