/**
 * Data validation utilities to prevent component crashes
 *
 * NOTE: validateStaff, validateService, validateTimeSlot were removed — they
 * belonged to a prior booking/scheduling SaaS template with no active consumers.
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

const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 11;

export function safeParseDate(
  dateString: string | Date | null | undefined
): Date | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    if (year < DATE_VALIDATION_BOUNDS.MIN_YEAR || year > DATE_VALIDATION_BOUNDS.MAX_YEAR) return null;
    return date;
  } catch {
    return null;
  }
}

export function safeFormatTimeWithTimezone(
  dateString: string | Date | null | undefined,
  timezone: string
): string {
  if (!dateString) return FALLBACK_MESSAGES.INVALID_TIME;
  try {
    const utcString = dateString instanceof Date ? dateString.toISOString() : dateString;
    return TimeService.formatWithLabel(
      TimeService.fromUTC(utcString, timezone),
      timezone,
      "h:mm a zzz"
    );
  } catch {
    return FALLBACK_MESSAGES.INVALID_TIME;
  }
}

export function safeFormatDateWithTimezone(
  dateString: string | Date | null | undefined,
  timezone: string
): string {
  if (!dateString) return FALLBACK_MESSAGES.INVALID_DATE;
  try {
    const utcString = dateString instanceof Date ? dateString.toISOString() : dateString;
    return TimeService.formatWithLabel(
      TimeService.fromUTC(utcString, timezone),
      timezone,
      "MMMM d, yyyy zzz"
    );
  } catch {
    return FALLBACK_MESSAGES.INVALID_DATE;
  }
}

export function safeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

export function safeFormatPrice(price: unknown): string {
  if (price === null || price === undefined) return FALLBACK_MESSAGES.DEFAULT_PRICE;
  try {
    const numPrice = parsePrice(price);
    if (isNaN(numPrice)) return FALLBACK_MESSAGES.DEFAULT_PRICE;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numPrice);
  } catch {
    return FALLBACK_MESSAGES.DEFAULT_PRICE;
  }
}

export function validateApiResponse(response: unknown, expectedFields: string[]): boolean {
  if (!response || typeof response !== "object" || response === null) return false;
  return expectedFields.every((field) => {
    const value = (response as Record<string, unknown>)[field];
    return value !== null && value !== undefined;
  });
}

export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || typeof jsonString !== "string") return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

export function parsePrice(price: unknown): number {
  if (typeof price === "object" && price !== null && "toString" in price) {
    return parseFloat((price as { toString(): string }).toString());
  } else if (typeof price === "string") {
    return parseFloat(price);
  } else if (typeof price === "number") {
    return price;
  }
  return NaN;
}
