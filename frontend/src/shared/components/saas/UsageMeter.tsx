/**
 * Usage Meter Component
 *
 * Visual indicator for subscription usage with progress bar and warnings.
 */

"use client";

import { Progress } from "@/shared/components/ui/progress";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";

interface UsageMeterProps {
  currentUsage: number;
  usageLimit: number | null;
  resetDate?: Date | null;
  className?: string;
}

export function UsageMeter({
  currentUsage,
  usageLimit,
  resetDate,
  className,
}: UsageMeterProps) {
  if (usageLimit === null) {
    return (
      <div className={cn("text-base text-muted-foreground", className)}>
        Unlimited usage
      </div>
    );
  }

  const percentageUsed =
    usageLimit === 0 ? 0 : Math.min((currentUsage / usageLimit) * 100, 100);
  const isWarning = percentageUsed >= 80;
  const isLimitReached = percentageUsed >= 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-base">
        <span className="text-muted-foreground">
          {currentUsage} / {usageLimit} calculations
        </span>
        <span
          className={cn(
            "font-medium",
            isLimitReached && "text-destructive",
            isWarning && !isLimitReached && "text-yellow-600"
          )}
        >
          {Math.round(percentageUsed)}%
        </span>
      </div>
      <Progress
        value={percentageUsed}
        className={cn(
          "h-2",
          isLimitReached && "[&>div]:bg-destructive",
          isWarning && !isLimitReached && "[&>div]:bg-yellow-600"
        )}
      />
      {resetDate && (
        <p className="text-sm text-muted-foreground">
          Resets on {resetDate.toLocaleDateString()}
        </p>
      )}
      {isLimitReached && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've reached your monthly limit. Use Manage Subscription to change
            your plan.
          </AlertDescription>
        </Alert>
      )}
      {isWarning && !isLimitReached && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're approaching your monthly limit ({Math.round(percentageUsed)}%
            used).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
