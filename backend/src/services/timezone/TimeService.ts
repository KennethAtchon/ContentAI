import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { parseISO, format } from "date-fns";

/**
 * Comprehensive timezone service for handling IANA timezone conversions
 * Replaces the old TimezoneUtils with proper timezone-aware functionality
 */
export class TimeService {
  /**
   * Common IANA timezone identifiers for validation and selection
   */
  static readonly COMMON_TIMEZONES = Object.freeze([
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Vancouver",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Rome",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Kolkata",
    "Australia/Sydney",
    "Australia/Melbourne",
  ] as const);

  /**
   * Validates if a string is a valid IANA timezone identifier
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      // Check for null, undefined, or empty string
      if (!timezone || typeof timezone !== "string") {
        return false;
      }

      // Trim whitespace and check if it's still valid
      const trimmed = timezone.trim();
      if (trimmed !== timezone || trimmed.length === 0) {
        return false; // Reject strings with leading/trailing whitespace or empty strings
      }

      // Try to create a date in the timezone - this will throw if invalid
      // This is the most reliable validation method
      Intl.DateTimeFormat("en", { timeZone: timezone });

      // Basic pattern validation to catch obvious non-timezone strings
      // Allow UTC and standard IANA format (Area/Location)
      const basicPattern = /^(UTC|[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)*)$/;
      if (!basicPattern.test(timezone)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates if a string is a valid ISO 8601 datetime format
   */
  private static validateISOFormat(dateString: string): void {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoRegex.test(dateString)) {
      throw new Error(
        `Invalid ISO format: ${dateString}. Expected ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)`,
      );
    }

    // Parse components to validate exact date values
    const match = dateString.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z?$/,
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      const secondNum = parseInt(second, 10);

      // Validate ranges
      if (monthNum < 1 || monthNum > 12) {
        throw new Error(
          `Invalid ISO format: ${dateString}. Month must be 01-12`,
        );
      }
      if (hourNum > 23) {
        throw new Error(
          `Invalid ISO format: ${dateString}. Hour must be 00-23`,
        );
      }
      if (minuteNum > 59) {
        throw new Error(
          `Invalid ISO format: ${dateString}. Minute must be 00-59`,
        );
      }
      if (secondNum > 59) {
        throw new Error(
          `Invalid ISO format: ${dateString}. Second must be 00-59`,
        );
      }

      // Validate day against month/year
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      if (dayNum < 1 || dayNum > daysInMonth) {
        throw new Error(
          `Invalid ISO format: ${dateString}. Day ${dayNum} is not valid for month ${monthNum}`,
        );
      }
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(
        `Invalid ISO format: ${dateString}. Date value is not valid`,
      );
    }
  }

  /**
   * Validates timezone parameter
   */
  private static validateTimezone(timezone: string): void {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(
        `Invalid timezone: ${timezone}. Must be a valid IANA timezone identifier.`,
      );
    }
  }

  /**
   * Converts local time in a specific timezone to UTC
   * @param localTime - ISO string representing local time
   * @param timezone - IANA timezone identifier (e.g., "America/New_York")
   * @returns UTC ISO string
   */
  static toUTC(localTime: string, timezone: string): string {
    this.validateISOFormat(localTime);
    this.validateTimezone(timezone);

    try {
      const localDate = parseISO(localTime);
      const utcDate = fromZonedTime(localDate, timezone);
      return utcDate.toISOString();
    } catch (error) {
      throw new Error(
        `Failed to convert local time to UTC: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Converts UTC time to local time in a specific timezone
   * @param utcTime - UTC ISO string
   * @param timezone - IANA timezone identifier (e.g., "America/New_York")
   * @returns Local time as ISO string
   */
  static fromUTC(utcTime: string, timezone: string): string {
    this.validateISOFormat(utcTime);
    this.validateTimezone(timezone);

    try {
      const utcDate = parseISO(utcTime);
      const localDate = toZonedTime(utcDate, timezone);
      // Return local time as ISO string WITHOUT 'Z' suffix (not UTC)
      return format(localDate, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    } catch (error) {
      throw new Error(
        `Failed to convert UTC to local time: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Formats a time with timezone label for display
   * @param time - ISO string (UTC or local)
   * @param timezone - IANA timezone identifier
   * @param formatString - date-fns format string (default: "MMM d, yyyy 'at' h:mm a zzz")
   * @returns Formatted time string with timezone abbreviation
   */
  static formatWithLabel(
    time: string,
    timezone: string,
    formatString = "MMM d, yyyy 'at' h:mm a zzz",
  ): string {
    this.validateISOFormat(time);
    this.validateTimezone(timezone);

    try {
      const date = parseISO(time);
      const zonedDate = toZonedTime(date, timezone);
      return format(zonedDate, formatString);
    } catch (error) {
      throw new Error(
        `Failed to format time with label: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Gets timezone abbreviation (e.g., "EST", "PST") for a given timezone at a specific date
   * @param timezone - IANA timezone identifier
   * @param date - Optional date to check (defaults to current date)
   * @returns Timezone abbreviation
   */
  static getTimezoneAbbreviation(timezone: string, date?: Date): string {
    this.validateTimezone(timezone);

    try {
      const checkDate = date || new Date();
      const formatter = new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        timeZoneName: "short",
      });

      const parts = formatter.formatToParts(checkDate);
      const timeZonePart = parts.find((part) => part.type === "timeZoneName");
      return timeZonePart?.value || "Unknown";
    } catch (error) {
      throw new Error(
        `Failed to get timezone abbreviation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Gets the current time in a specific timezone
   * @param timezone - IANA timezone identifier
   * @returns Current time in the specified timezone as ISO string
   */
  static getCurrentTimeInTimezone(timezone: string): string {
    this.validateTimezone(timezone);

    try {
      const now = new Date();
      const localTime = toZonedTime(now, timezone);
      return localTime.toISOString();
    } catch (error) {
      throw new Error(
        `Failed to get current time in timezone: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Checks if a timezone observes DST at a given date
   * @param timezone - IANA timezone identifier
   * @param date - Date to check (defaults to current date)
   * @returns true if DST is in effect at the given date
   */
  static isDSTInEffect(timezone: string, date?: Date): boolean {
    this.validateTimezone(timezone);

    try {
      const checkDate = date || new Date();

      // Create formatter for the timezone
      const formatter = new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        timeZoneName: "long",
      });

      const parts = formatter.formatToParts(checkDate);
      const timeZoneName =
        parts.find((part) => part.type === "timeZoneName")?.value || "";

      // Common DST indicators (not exhaustive, but covers major cases)
      const dstKeywords = ["daylight", "summer", "dst"];
      return dstKeywords.some((keyword) =>
        timeZoneName.toLowerCase().includes(keyword),
      );
    } catch (error) {
      throw new Error(
        `Failed to check DST status: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Gets user's browser timezone
   * @returns IANA timezone identifier from browser
   */
  static getBrowserTimezone(): string {
    try {
      const formatter = new Intl.DateTimeFormat();
      return formatter.resolvedOptions().timeZone;
    } catch {
      return "UTC"; // Fallback to UTC if detection fails
    }
  }

  /**
   * Calculates time difference between two timezones in minutes
   * @param timezone1 - First timezone
   * @param timezone2 - Second timezone
   * @param date - Date to calculate difference for (defaults to current date)
   * @returns Difference in minutes (timezone1 - timezone2)
   */
  static getTimezoneOffset(
    timezone1: string,
    timezone2: string,
    date?: Date,
  ): number {
    this.validateTimezone(timezone1);
    this.validateTimezone(timezone2);

    try {
      const checkDate = date || new Date();

      const utcTime = checkDate.getTime();
      const time1 = toZonedTime(new Date(utcTime), timezone1).getTime();
      const time2 = toZonedTime(new Date(utcTime), timezone2).getTime();

      return Math.round((time1 - time2) / (1000 * 60));
    } catch (error) {
      throw new Error(
        `Failed to calculate timezone offset: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Creates a date range across DST boundaries for testing
   * @param timezone - IANA timezone identifier
   * @param year - Year to check (defaults to current year)
   * @returns Object with DST transition dates if they exist
   */
  static getDSTTransitions(
    timezone: string,
    year?: number,
  ): { spring?: Date; fall?: Date } {
    this.validateTimezone(timezone);

    const checkYear = year || new Date().getFullYear();
    const transitions: { spring?: Date; fall?: Date } = {};

    try {
      // Check each month for DST transitions
      for (let month = 0; month < 12; month++) {
        const date1 = new Date(checkYear, month, 1);
        const date2 = new Date(checkYear, month, 15);

        const isDST1 = this.isDSTInEffect(timezone, date1);
        const isDST2 = this.isDSTInEffect(timezone, date2);

        if (!isDST1 && isDST2) {
          transitions.spring = date2; // Spring forward
        } else if (isDST1 && !isDST2) {
          transitions.fall = date2; // Fall back
        }
      }
    } catch {
      // Return empty object if DST detection fails
    }

    return transitions;
  }
}
