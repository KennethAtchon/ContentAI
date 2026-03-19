/**
 * FeatureCard Component
 *
 * Standardized card component with icon, title, and description.
 */

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/utils/helpers/utils";

export interface FeatureCardProps {
  /**
   * Icon component
   */
  icon: LucideIcon;
  /**
   * Card title
   */
  title: string;
  /**
   * Card description
   */
  description?: string;
  /**
   * Custom content to render in card
   */
  children?: React.ReactNode;
  /**
   * Whether card should be hoverable
   * @default false
   */
  hoverable?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  children,
  hoverable = false,
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "border-2",
        hoverable && "hover:shadow-lg transition-shadow",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mb-2 text-2xl font-semibold">{title}</h3>
        {description && (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
