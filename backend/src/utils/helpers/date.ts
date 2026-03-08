import { parseISO, isValid } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { debugLog } from "@/utils/debug/debug";
import { TimeService } from "@/services/timezone/TimeService";

/**
 * Returns the boundaries of the current and previous calendar months as Date
 * objects. Used by analytics and usage-counting queries across multiple routes.
 */
export function getMonthBoundaries(): {
  startOfThisMonth: Date;
  startOfLastMonth: Date;
  endOfLastMonth: Date;
} {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // One millisecond before this month starts = last instant of last month
  const endOfLastMonth = new Date(startOfThisMonth.getTime() - 1);
  return { startOfThisMonth, startOfLastMonth, endOfLastMonth };
}

/**
 * Calculates the month-over-month percentage change between two values.
 * Returns 100 if last month was 0 and this month is non-zero (new growth),
 * or 0 if both months are 0.
 */
export function calculatePercentChange(
  lastMonth: number,
  thisMonth: number,
): number {
  if (lastMonth > 0) {
    return ((thisMonth - lastMonth) / lastMonth) * 100;
  }
  if (thisMonth > 0) return 100;
  return 0;
}

const DEFAULT_FORMAT = "MMM dd, yyyy";
const DEFAULT_FALLBACK = "N/A";

/**
 * Safely format a date string with timezone awareness
 * @param dateValue - UTC date string, Date object, null, or undefined
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @param formatString - Format string for date-fns format function
 * @param fallback - Fallback string to return if date is invalid
 * @returns Formatted date string with timezone label or fallback
 */
export function safeFormatDateWithTimezone(
  dateValue: string | Date | null | undefined,
  timezone: string,
  formatString: string = DEFAULT_FORMAT,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!dateValue) {
    return fallback;
  }

  try {
    // Convert Date object to ISO string
    const utcString =
      dateValue instanceof Date ? dateValue.toISOString() : dateValue;

    // Validate the date first to avoid TimeService errors
    const parsedDate = parseISO(utcString);
    if (!isValid(parsedDate)) {
      return fallback;
    }

    // For UTC timezone, use date-fns-tz directly to avoid TimeService validation issues
    if (timezone === "UTC") {
      return formatInTimeZone(parsedDate, timezone, formatString);
    }

    // Use TimeService for other timezones
    return TimeService.formatWithLabel(
      TimeService.fromUTC(utcString, timezone),
      timezone,
      formatString,
    );
  } catch (error) {
    debugLog.warn(
      "Timezone-aware date formatting error",
      { utility: "date", timezone },
      error,
    );
    return fallback;
  }
}

/**
 * Format date with automatic timezone detection
 * @param dateString - UTC date string to format
 * @param formatString - Format string for date-fns format function
 * @returns Formatted date string with timezone label
 */
export function formatDateWithTimezone(
  dateString: string | null | undefined,
  formatString: string = DEFAULT_FORMAT,
): string {
  const timezone = TimeService.getBrowserTimezone();
  return safeFormatDateWithTimezone(dateString, timezone, formatString);
}
