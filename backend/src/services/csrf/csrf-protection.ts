import { systemLogger } from "@/utils/system/system-logger";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { debugLog } from "@/utils/debug";
import { CSRF_SECRET } from "@/utils/config/envUtil";

/**
 * CSRF Protection Service
 * Provides protection against Cross-Site Request Forgery attacks
 * by generating and validating encrypted CSRF tokens bound to Firebase UID
 *
 * Security Model:
 * - CSRF tokens only for authenticated users
 * - Tokens encrypted with AES-256-GCM
 * - Tokens bound to Firebase UID (not session ID)
 */

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generates encrypted CSRF token bound to Firebase UID
 * Uses AES-256-GCM for authenticated encryption
 */
export function generateCSRFToken(firebaseUID: string): string {
  const timestamp = Date.now().toString();
  const randomValue = randomBytes(16).toString("hex");
  const payload = `${timestamp}:${randomValue}:${firebaseUID}`;

  // Encrypt payload with AES-256-GCM
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(CSRF_SECRET, "hex"),
    iv,
  );

  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:encrypted:authTag (all hex)
  const token = `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
  return Buffer.from(token).toString("base64url");
}

/**
 * Validates and decrypts CSRF token, returns true if valid
 */
export function validateCSRFToken(token: string, expectedUID: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [ivHex, encryptedHex, authTagHex] = decoded.split(":");

    if (!ivHex || !encryptedHex || !authTagHex) {
      debugLog.debug("CSRF token validation failed - Invalid format", {
        service: "csrf-protection",
      });
      return false;
    }

    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    // Decrypt payload
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(CSRF_SECRET, "hex"),
      iv,
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    const [timestamp, _randomValue, firebaseUID] = decrypted.split(":");

    // Validate expiry
    const tokenTime = parseInt(timestamp, 10);
    if (Date.now() - tokenTime > TOKEN_EXPIRY) {
      debugLog.debug("CSRF token validation failed - Token expired", {
        service: "csrf-protection",
      });
      return false;
    }

    // Validate Firebase UID match
    if (firebaseUID !== expectedUID) {
      debugLog.debug("CSRF token validation failed - UID mismatch", {
        service: "csrf-protection",
      });
      return false;
    }

    debugLog.debug("CSRF token validation successful", {
      service: "csrf-protection",
    });
    return true;
  } catch (error) {
    systemLogger.error(
      "CSRF token validation error",
      { service: "csrf-protection" },
      error,
    );
    return false;
  }
}

/**
 * Extracts CSRF token from request headers or body
 */
export async function extractCSRFToken(
  request: Request,
): Promise<string | null> {
  // Check X-CSRF-Token header first
  const headerToken = request.headers.get("X-CSRF-Token");
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }

  // Check for token in request body for form submissions
  const contentType = request.headers.get("content-type");
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    try {
      // Clone the request to avoid consuming the body
      const clonedRequest = request.clone();
      const formData = await clonedRequest.formData();
      const token = formData.get("_token");
      return typeof token === "string" ? token : null;
    } catch {
      // If we can't parse form data, continue checking other methods
    }
  }

  // Check for token in JSON body
  if (contentType?.includes("application/json")) {
    try {
      // Clone the request to avoid consuming the body
      const clonedRequest = request.clone();
      const body = (await clonedRequest.json()) as {
        _token?: string;
        csrfToken?: string;
      };
      return body._token || body.csrfToken || null;
    } catch {
      // If we can't parse JSON, token not found in body
    }
  }

  return null;
}

/**
 * Middleware helper to validate CSRF for authenticated users
 */
export async function requireCSRFToken(
  request: Request,
  firebaseUID: string,
): Promise<boolean> {
  const method = request.method.toUpperCase();

  // Skip CSRF validation for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const token = await extractCSRFToken(request);
  if (!token) {
    debugLog.debug("CSRF validation failed - No token found", {
      service: "csrf-protection",
    });
    return false;
  }

  return validateCSRFToken(token, firebaseUID);
}

/**
 * API route helper to get CSRF token response
 */
export function getCSRFTokenResponse(firebaseUID: string) {
  const token = generateCSRFToken(firebaseUID);
  return {
    csrfToken: token,
    expires: new Date(Date.now() + TOKEN_EXPIRY).toISOString(),
  };
}
