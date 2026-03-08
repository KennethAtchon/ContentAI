/**
 * FormError Component
 *
 * Standardized form error display for React Hook Form integration.
 */

import { FieldError } from "react-hook-form";

export interface FormErrorProps {
  /**
   * Error object from React Hook Form
   */
  error?: FieldError;
  /**
   * Custom error message (takes precedence over error.message)
   */
  message?: string;
  /**
   * Custom className
   */
  className?: string;
}

export function FormError({ error, message, className }: FormErrorProps) {
  const displayMessage = message || error?.message;

  if (!displayMessage) {
    return null;
  }

  return (
    <p className={`text-sm text-destructive mt-1 ${className || ""}`}>
      {displayMessage}
    </p>
  );
}
