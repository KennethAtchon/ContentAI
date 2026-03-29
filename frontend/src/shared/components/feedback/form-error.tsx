import { FieldError } from "react-hook-form";

export interface FormErrorProps {
  error?: FieldError;
  message?: string;
  className?: string;
}

export function FormError({ error, message, className }: FormErrorProps) {
  const displayMessage = message || error?.message;
  if (!displayMessage) return null;
  return (
    <p className={`text-base text-destructive mt-1 ${className || ""}`}>
      {displayMessage}
    </p>
  );
}
