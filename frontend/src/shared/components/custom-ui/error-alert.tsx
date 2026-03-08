/**
 * ErrorAlert Component
 *
 * Standardized error alert display component.
 */

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { AlertCircle } from "lucide-react";

export interface ErrorAlertProps {
  /**
   * Error message to display
   */
  error: string | null | undefined;
  /**
   * Optional title (defaults to "Error")
   */
  title?: string;
  /**
   * Variant styling
   */
  variant?: "default" | "destructive";
  /**
   * Custom className
   */
  className?: string;
}

export function ErrorAlert({
  error,
  title,
  variant = "destructive",
  className,
}: ErrorAlertProps) {
  if (!error) {
    return null;
  }

  return (
    <Alert variant={variant} className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {title && <span className="font-semibold">{title}: </span>}
        {error}
      </AlertDescription>
    </Alert>
  );
}
