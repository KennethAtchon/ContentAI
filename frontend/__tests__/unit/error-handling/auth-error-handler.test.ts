/**
 * Unit tests for auth error handler: getAuthErrorMessage mapping Firebase codes to messages.
 */

import { describe, it, expect, mock } from "bun:test";

// Mock debug before importing the module under test. Must expose the full logger surface:
// a partial mock replaces the real module for the whole process and breaks later tests.
const mockWarn = mock(() => {});
const noop = mock(() => {});
const debugLogStub = {
  info: noop,
  warn: mockWarn,
  error: noop,
  debug: noop,
  timezone: noop,
};
mock.module("@/shared/debug/debug", () => ({
  debugLog: debugLogStub,
  default: debugLogStub,
}));

import { getAuthErrorMessage } from "@/shared/errors/auth-error-handler";

// Error with code property (Firebase-style)
class ErrorWithCode extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "FirebaseError";
    this.code = code;
  }
}

describe("auth-error-handler", () => {
  const t = (key: string) => `translated:${key}`;

  describe("getAuthErrorMessage", () => {
    it("returns translated message for auth/invalid-credential", () => {
      const err = new ErrorWithCode("Invalid", "auth/invalid-credential");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_incorrect_email_or_password"
      );
    });

    it("returns translated message for auth/wrong-password", () => {
      const err = new ErrorWithCode("Wrong password", "auth/wrong-password");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_incorrect_email_or_password"
      );
    });

    it("returns translated message for auth/user-not-found", () => {
      const err = new ErrorWithCode("Not found", "auth/user-not-found");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_incorrect_email_or_password"
      );
    });

    it("returns translated message for auth/invalid-email", () => {
      const err = new ErrorWithCode("Bad email", "auth/invalid-email");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_invalid_email"
      );
    });

    it("returns translated message for auth/user-disabled", () => {
      const err = new ErrorWithCode("Disabled", "auth/user-disabled");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_account_disabled"
      );
    });

    it("returns translated message for auth/too-many-requests", () => {
      const err = new ErrorWithCode("Too many", "auth/too-many-requests");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_too_many_attempts"
      );
    });

    it("returns translated message for auth/email-already-in-use", () => {
      const err = new ErrorWithCode("Exists", "auth/email-already-in-use");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_email_already_in_use"
      );
    });

    it("returns translated message for auth/weak-password", () => {
      const err = new ErrorWithCode("Weak", "auth/weak-password");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_weak_password"
      );
    });

    it("returns translated message for auth/invalid-password", () => {
      const err = new ErrorWithCode("Invalid", "auth/invalid-password");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_invalid_password"
      );
    });

    it("returns translated message for auth/network-request-failed", () => {
      const err = new ErrorWithCode("Network", "auth/network-request-failed");
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_network_failed"
      );
    });

    it("returns translated message for auth/operation-not-allowed", () => {
      const err = new ErrorWithCode(
        "Not allowed",
        "auth/operation-not-allowed"
      );
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_operation_not_allowed"
      );
    });

    it("returns translated message for auth/requires-recent-login", () => {
      const err = new ErrorWithCode(
        "Recent login",
        "auth/requires-recent-login"
      );
      expect(getAuthErrorMessage(err, t)).toBe(
        "translated:auth_error_requires_recent_login"
      );
    });

    it("returns generic for unknown Firebase code", () => {
      const err = new ErrorWithCode("Weird", "auth/unknown-code");

      expect(getAuthErrorMessage(err, t)).toBe("translated:auth_error_generic");

      // Verify debugLog.warn was called with the expected message
      expect(mockWarn).toHaveBeenCalled();
      expect(mockWarn.mock.calls[0][0]).toContain(
        "Unhandled Firebase error code"
      );
    });

    it("returns error.message for non-Firebase Error", () => {
      const err = new Error("Plain error message");
      expect(getAuthErrorMessage(err, t)).toBe("Plain error message");
    });

    it("returns generic for non-Error (fallback)", () => {
      expect(getAuthErrorMessage(42, t)).toBe("translated:auth_error_generic");
    });
  });
});
