/**
 * Data validation utilities to prevent component crashes
 */
import { TimeService } from "@/shared/services/timezone/TimeService";

const DATE_VALIDATION_BOUNDS = {
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
} as const;

const FALLBACK_MESSAGES = {
  INVALID_TIME: "Invalid time",
  INVALID_DATE: "Invalid date",
  DEFAULT_PRICE: "$0.00",
} as const;

const SERVICE_NAME_MAX_LENGTH = 100;
const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 11;

/**
 * Safe date parsing that won't throw errors
 */
export function safeParseDate(
  dateString: string | Date | null | undefined
): Date | null {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return null;
    }

    const year = date.getFullYear();
    if (
      year < DATE_VALIDATION_BOUNDS.MIN_YEAR ||
      year > DATE_VALIDATION_BOUNDS.MAX_YEAR
    ) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

/**
 * Safe time formatting with timezone awareness
 */
export function safeFormatTimeWithTimezone(
  dateString: string | Date | null | undefined,
  timezone: string
): string {
  if (!dateString) return FALLBACK_MESSAGES.INVALID_TIME;

  try {
    const utcString =
      dateString instanceof Date ? dateString.toISOString() : dateString;
    return TimeService.formatWithLabel(
      TimeService.fromUTC(utcString, timezone),
      timezone,
      "h:mm a zzz"
    );
  } catch {
    return FALLBACK_MESSAGES.INVALID_TIME;
  }
}

/**
 * Safe date formatting with timezone awareness
 */
export function safeFormatDateWithTimezone(
  dateString: string | Date | null | undefined,
  timezone: string
): string {
  if (!dateString) return FALLBACK_MESSAGES.INVALID_DATE;

  try {
    const utcString =
      dateString instanceof Date ? dateString.toISOString() : dateString;
    return TimeService.formatWithLabel(
      TimeService.fromUTC(utcString, timezone),
      timezone,
      "MMMM d, yyyy zzz"
    );
  } catch {
    return FALLBACK_MESSAGES.INVALID_DATE;
  }
}

/**
 * Validate staff object
 */
export function validateStaff(
  staff: unknown
): staff is { id: string; name: string } {
  return !!(
    staff &&
    typeof staff === "object" &&
    staff !== null &&
    "id" in staff &&
    "name" in staff &&
    typeof (staff as { id: string; name: string }).id === "string" &&
    (staff as { id: string; name: string }).id.length > 0 &&
    typeof (staff as { id: string; name: string }).name === "string" &&
    (staff as { id: string; name: string }).name.length > 0
  );
}

/**
 * Validate service description
 */
export function validateService(serviceName: string): boolean {
  return !!(
    serviceName &&
    typeof serviceName === "string" &&
    serviceName.trim().length > 0 &&
    serviceName.trim().length <= SERVICE_NAME_MAX_LENGTH
  );
}

/**
 * Validate time slot object
 */
export function validateTimeSlot(slot: unknown): boolean {
  return !!(
    slot &&
    typeof slot === "object" &&
    slot !== null &&
    "id" in slot &&
    "startTime" in slot &&
    "endTime" in slot &&
    "staff" in slot &&
    typeof (
      slot as {
        id: string;
        startTime: unknown;
        endTime: unknown;
        staff: unknown;
      }
    ).id === "string" &&
    (
      slot as {
        id: string;
        startTime: unknown;
        endTime: unknown;
        staff: unknown;
      }
    ).id.length > 0 &&
    safeParseDate(
      (
        slot as {
          id: string;
          startTime: string | Date | null | undefined;
          endTime: string | Date | null | undefined;
          staff: unknown;
        }
      ).startTime
    ) &&
    safeParseDate(
      (
        slot as {
          id: string;
          startTime: string | Date | null | undefined;
          endTime: string | Date | null | undefined;
          staff: unknown;
        }
      ).endTime
    ) &&
    validateStaff(
      (
        slot as {
          id: string;
          startTime: string | Date | null | undefined;
          endTime: string | Date | null | undefined;
          staff: unknown;
        }
      ).staff
    )
  );
}

/**
 * Safe array access
 */
export function safeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

/**
 * Safe price formatting - handles Decimal, number, string
 */
export function safeFormatPrice(price: unknown): string {
  if (price === null || price === undefined) {
    return FALLBACK_MESSAGES.DEFAULT_PRICE;
  }

  try {
    const numPrice = parsePrice(price);

    if (isNaN(numPrice)) {
      return FALLBACK_MESSAGES.DEFAULT_PRICE;
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numPrice);
  } catch {
    return FALLBACK_MESSAGES.DEFAULT_PRICE;
  }
}

/**
 * API response validation
 */
export function validateApiResponse(
  response: unknown,
  expectedFields: string[]
): boolean {
  if (!response || typeof response !== "object" || response === null) {
    return false;
  }

  return expectedFields.every((field) => {
    const value = (response as Record<string, unknown>)[field];
    return value !== null && value !== undefined;
  });
}

/**
 * Safe JSON parsing
 */
export function safeJsonParse<T>(
  jsonString: string | null | undefined,
  fallback: T
): T {
  if (!jsonString || typeof jsonString !== "string") return fallback;

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (basic)
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== "string") return false;

  const digitsOnly = phone.replace(/\D/g, "");
  return (
    digitsOnly.length >= PHONE_MIN_DIGITS &&
    digitsOnly.length <= PHONE_MAX_DIGITS
  );
}

/**
 * Helper function to parse price from various formats
 */
export function parsePrice(price: unknown): number {
  if (typeof price === "object" && price !== null && "toString" in price) {
    // Likely a Decimal object (from Drizzle/PostgreSQL)
    return parseFloat((price as { toString(): string }).toString());
  } else if (typeof price === "string") {
    return parseFloat(price);
  } else if (typeof price === "number") {
    return price;
  }
  return NaN;
}
