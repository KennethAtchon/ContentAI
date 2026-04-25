import { systemLogger } from "@/utils/system/system-logger";
/**
 * Firebase Authentication Error Handler
 *
 * Maps Firebase error codes to user-friendly error messages
 */


// Define FirebaseError type for backend compatibility
interface FirebaseError extends Error {
  code: string;
}

/**
 * Maps Firebase authentication error codes to user-friendly messages
 * @param error - The error object (FirebaseError or generic Error)
 * @param t - Translation function from next-intl
 * @returns User-friendly error message
 */
export function getAuthErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string {
  // Check if it's a Firebase error
  if (error instanceof Error && "code" in error) {
    const firebaseError = error as FirebaseError;
    const errorCode = firebaseError.code;

    // Map Firebase error codes to user-friendly messages
    switch (errorCode) {
      // Sign in errors
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return t("auth_error_incorrect_email_or_password");

      case "auth/invalid-email":
        return t("auth_error_invalid_email");

      case "auth/user-disabled":
        return t("auth_error_account_disabled");

      case "auth/too-many-requests":
        return t("auth_error_too_many_attempts");

      // Sign up errors
      case "auth/email-already-in-use":
        return t("auth_error_email_already_in_use");

      case "auth/weak-password":
        return t("auth_error_weak_password");

      case "auth/invalid-password":
        return t("auth_error_invalid_password");

      // Network errors
      case "auth/network-request-failed":
        return t("auth_error_network_failed");

      // Generic errors
      case "auth/operation-not-allowed":
        return t("auth_error_operation_not_allowed");

      case "auth/requires-recent-login":
        return t("auth_error_requires_recent_login");

      default:
        // For unknown Firebase errors, log the code but show generic message
        systemLogger.warn("Unhandled Firebase error code", {
          service: "auth-error-handler",
          operation: "getAuthErrorMessage",
          errorCode,
        });
        return t("auth_error_generic");
    }
  }

  // For non-Firebase errors, return the error message if available
  if (error instanceof Error) {
    return error.message;
  }

  // Fallback to generic error message
  return t("auth_error_generic");
}
