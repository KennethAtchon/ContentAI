/**
 * EmptyState Component
 *
 * Standardized empty state display for when there's no data to show.
 */

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@tanstack/react-router";

export interface EmptyStateProps {
  /**
   * Icon to display
   */
  icon: LucideIcon;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Optional action button
   */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /**
   * Custom content to render instead of default structure
   */
  children?: ReactNode;
  /**
   * Variant styling
   */
  variant?: "default" | "minimal";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  variant = "default",
}: EmptyStateProps) {
  if (children) {
    return <div className="py-8 text-center">{children}</div>;
  }

  if (variant === "minimal") {
    return (
      <div className="py-8 text-center">
        <Icon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">{title}</p>
        {description && (
          <p className="text-muted-foreground mb-4">{description}</p>
        )}
        {action && (
          <>
            {action.href ? (
              <Button asChild>
                <Link to={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button onClick={action.onClick}>{action.label}</Button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="border-2">
      <CardContent className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{title}</h3>
          {description && (
            <p className="mb-6 max-w-md text-muted-foreground">{description}</p>
          )}
          {action && (
            <>
              {action.href ? (
                <Button asChild>
                  <Link to={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button onClick={action.onClick}>{action.label}</Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
