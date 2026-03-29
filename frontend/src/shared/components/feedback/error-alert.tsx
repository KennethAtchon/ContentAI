import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { AlertCircle } from "lucide-react";

export interface ErrorAlertProps {
  error: string | null | undefined;
  title?: string;
  variant?: "default" | "destructive";
  className?: string;
}

export function ErrorAlert({
  error,
  title,
  variant = "destructive",
  className,
}: ErrorAlertProps) {
  if (!error) return null;

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
