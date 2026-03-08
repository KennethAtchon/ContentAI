/**
 * PII Data Sanitization Utility
 *
 * Comprehensive utility for detecting and sanitizing Personally Identifiable Information
 * in logs, API responses, and error messages to ensure GDPR compliance and data protection.
 *
 * Addresses Ticket #20: PII Data Exposure in Logs and API Responses
 */

import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";
import { debugLog } from "../debug/debug";

export interface SanitizationConfig {
  preserveLength?: boolean; // Keep original length with asterisks
  showFirst?: number; // Show first N characters
  showLast?: number; // Show last N characters
  replacement?: string; // Custom replacement text
}

// Sensitive field patterns that should be redacted
const SENSITIVE_FIELD_PATTERNS = [
  // Direct PII fields
  "email",
  "emailAddress",
  "userEmail",
  "customerEmail",
  "phone",
  "phoneNumber",
  "telephone",
  "mobile",
  "cellPhone",
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "apiKey",
  "ssn",
  "socialSecurityNumber",
  "nin",
  "nationalId",
  "creditCard",
  "cardNumber",
  "cvv",
  "cvc",
  "securityCode",
  "address",
  "streetAddress",
  "homeAddress",
  "billingAddress",
  "firstName",
  "lastName",
  "fullName",
  "displayName",
  "dateOfBirth",
  "birthDate",
  "dob",
  "passport",
  "driverLicense",
  "licenseNumber",
  "bankAccount",
  "accountNumber",
  "routingNumber",
  "firebaseUid",
  "userId",
  "customerId",
  "patientId",
  "id",
];

// Regex patterns for PII detection - order matters, more specific patterns first
const PII_PATTERNS = {
  creditCard:
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|30[0-5][0-9]{13}|36[0-9]{12}|38[0-9]{12}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  email:
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+(?:\.[A-Z|a-z]{2,}|[A-Za-z0-9-]*)\b/g,
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  jwt: /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g,
};

// Default sanitization configurations
const DEFAULT_SANITIZATION = {
  email: { replacement: "[EMAIL_REDACTED]" },
  phone: { replacement: "[PHONE_REDACTED]" },
  creditCard: { replacement: "[CARD_REDACTED]" },
  ssn: { replacement: "[SSN_REDACTED]" },
  password: { replacement: "[PASSWORD_REDACTED]" },
  token: { replacement: "[TOKEN_REDACTED]" },
  address: { replacement: "[ADDRESS_REDACTED]" },
  default: { replacement: "[PII_REDACTED]" },
};

/**
 * Validates if an email string is actually valid
 */
function isValidEmail(email: string): boolean {
  // More strict validation - no consecutive dots, proper domain format
  if (email.includes("..") || email.startsWith(".") || email.endsWith(".")) {
    return false;
  }

  const parts = email.split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain) return false;

  // Domain can be single word (like localhost) or multi-part
  // Check for consecutive dots in domain
  if (domain.includes("..")) return false;

  // Accept single word domains like localhost
  return true;
}

/**
 * Sanitizes a string by removing or redacting PII data
 *
 * SECURITY NOTE (SEC-011): Development Mode Behavior
 * - In development mode, sanitization is DISABLED for easier debugging
 * - This means PII may be logged in development logs
 * - Production mode ALWAYS sanitizes PII
 * - Developers should be aware that test data may contain real PII
 * - Never commit logs containing real PII to version control
 *
 * @param text - String to sanitize
 * @param config - Sanitization configuration options
 * @returns Sanitized string (or original in development)
 */
export function sanitizeString(
  text: string,
  config: SanitizationConfig = {}
): string {
  if (!text || typeof text !== "string") return text;

  // SECURITY WARNING: In development, skip sanitization for easier debugging
  // This means PII may appear in development logs - be careful with test data
  if (IS_DEVELOPMENT) {
    return text;
  }

  // Collect all matches from all patterns first
  const allMatches: Array<{
    start: number;
    end: number;
    type: string;
    replacement: string;
  }> = [];

  // Apply regex patterns for common PII with validation
  Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
    // Reset regex lastIndex to ensure proper matching
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Special validation for emails
      if (type === "email" && !isValidEmail(match[0])) {
        continue; // Skip invalid emails
      }

      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      const replacement =
        config.replacement ||
        DEFAULT_SANITIZATION[type as keyof typeof DEFAULT_SANITIZATION]
          ?.replacement ||
        "[REDACTED]";

      allMatches.push({
        start: matchStart,
        end: matchEnd,
        type,
        replacement,
      });
    }
  });

  // Sort matches by start position
  allMatches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches, keeping the first (most specific) one
  const filteredMatches: Array<{
    start: number;
    end: number;
    type: string;
    replacement: string;
  }> = [];
  for (const match of allMatches) {
    const hasOverlap = filteredMatches.some(
      (existing) =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end) ||
        (match.start <= existing.start && match.end >= existing.end)
    );

    if (!hasOverlap) {
      filteredMatches.push(match);
    }
  }

  // Apply replacements from right to left to maintain positions
  let sanitized = text;
  filteredMatches.reverse().forEach((match) => {
    sanitized =
      sanitized.substring(0, match.start) +
      match.replacement +
      sanitized.substring(match.end);
  });

  return sanitized;
}

/**
 * Sanitizes an object by redacting sensitive fields and PII in values
 *
 * SECURITY NOTE (SEC-011): Development Mode Behavior
 * - In development mode, sanitization is DISABLED for easier debugging
 * - This means PII may be logged in development logs
 * - Production mode ALWAYS sanitizes PII
 * - Developers should be aware that test data may contain real PII
 * - Never commit logs containing real PII to version control
 *
 * @param obj - Object to sanitize
 * @param depth - Current recursion depth (internal use)
 * @param maxDepth - Maximum recursion depth to prevent infinite loops
 * @returns Sanitized object (or original in development)
 */
export function sanitizeObject(obj: any, depth = 0, maxDepth = 5): unknown {
  // SECURITY WARNING: In development, skip sanitization for easier debugging
  // This means PII may appear in development logs - be careful with test data
  if (IS_DEVELOPMENT) {
    return obj;
  }

  // Prevent infinite recursion
  if (depth > maxDepth || obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1, maxDepth));
  }

  // Handle Date objects - preserve them as-is
  if (obj instanceof Date) {
    return obj;
  }

  // Handle Error objects - extract enumerable and non-enumerable properties
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message || ""),
      stack: obj.stack ? sanitizeString(obj.stack) : undefined,
      // Include any additional enumerable properties
      ...Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key,
          typeof value === "string"
            ? sanitizeString(value)
            : sanitizeObject(value, depth + 1, maxDepth),
        ])
      ),
    };
  }

  // Handle primitive types
  if (typeof obj !== "object") {
    return typeof obj === "string" ? sanitizeString(obj) : obj;
  }

  // Handle objects
  const sanitized: any = {};

  Object.entries(obj).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    // Check if the field name indicates sensitive data
    const isSensitiveField = SENSITIVE_FIELD_PATTERNS.some((pattern) =>
      lowerKey.includes(pattern.toLowerCase())
    );

    // Special case: plain 'id' field with numeric value is usually safe
    const isPlainNumericId = lowerKey === "id" && typeof value === "number";

    if (isSensitiveField && !isPlainNumericId) {
      // Redact sensitive fields
      if (typeof value === "string" && value.length > 0) {
        sanitized[key] = getFieldRedaction(lowerKey);
      } else {
        sanitized[key] = "[REDACTED]";
      }
    } else if (typeof value === "string") {
      // Sanitize string values for PII patterns
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object") {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, depth + 1, maxDepth);
    } else {
      // Keep other types as-is
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Get appropriate redaction for specific field types
 */
function getFieldRedaction(fieldName: string): string {
  if (fieldName.includes("email")) return "[EMAIL_REDACTED]";
  if (fieldName.includes("phone")) return "[PHONE_REDACTED]";
  if (fieldName.includes("password")) return "[PASSWORD_REDACTED]";
  if (fieldName.includes("card") || fieldName.includes("credit"))
    return "[CARD_REDACTED]";
  if (fieldName.includes("ssn") || fieldName.includes("social"))
    return "[SSN_REDACTED]";
  if (fieldName.includes("address")) return "[ADDRESS_REDACTED]";
  if (fieldName.includes("token") || fieldName.includes("key"))
    return "[TOKEN_REDACTED]";
  if (fieldName.includes("uid") || fieldName.includes("id"))
    return "[ID_REDACTED]";

  // Generic redaction
  return "[PII_REDACTED]";
}

/**
 * Safe error logging with stack trace sanitization
 */
export function safeLogError(message: string, error: any, context?: any): void {
  const sanitizedContext = context ? sanitizeObject(context) : undefined;
  const sanitizedMessage = sanitizeString(message);

  // Sanitize error object
  const sanitizedError = {
    message: error?.message ? sanitizeString(error.message) : "Unknown error",
    name: error?.name || "Error",
    stack: error?.stack ? sanitizeString(error.stack) : undefined,
    // Don't include the full error object to prevent PII leakage
  };

  debugLog.error(sanitizedMessage, {
    service: "pii-sanitization",
    operation: "logSecureError",
    error: sanitizedError,
    context: sanitizedContext,
  });
}

// Export default sanitization function
export const sanitize = sanitizeObject;
