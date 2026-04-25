import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";

export function Section({
  title,
  description,
  children,
  headerRight,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <Card className="border-overlay-sm bg-studio-surface">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-studio-fg">
            {title}
          </CardTitle>
          {headerRight}
        </div>
        {description && (
          <CardDescription className="text-sm text-dim-2">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}
