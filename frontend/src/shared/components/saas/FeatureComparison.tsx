/**
 * Feature Comparison Component
 *
 * Comparison table showing features across all subscription tiers.
 */

"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Check, X } from "lucide-react";
import { SubscriptionTier } from "@/shared/constants/subscription.constants";
import { cn } from "@/shared/utils/helpers/utils";

interface FeatureComparisonProps {
  currentTier?: SubscriptionTier;
}

export function FeatureComparison({ currentTier }: FeatureComparisonProps) {
  const features = [
    {
      name: "Reels / month",
      basic: "50",
      pro: "500",
      enterprise: "Unlimited",
    },
    {
      name: "AI Generations / month",
      basic: "20",
      pro: "200",
      enterprise: "Unlimited",
    },
    {
      name: "Content Queue Items",
      basic: "5",
      pro: "50",
      enterprise: "Unlimited",
    },
    {
      name: "Reel Discovery",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "AI Analysis",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Hook Generation",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Caption Generation",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Script Generation",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "Instagram Publishing",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "API Access",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "Support Level",
      basic: "Email",
      pro: "Priority",
      enterprise: "Dedicated",
    },
    {
      name: "Custom Branding",
      basic: false,
      pro: false,
      enterprise: true,
    },
  ];

  const renderValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-primary" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground" />
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead
              className={cn(
                "text-center",
                currentTier === "basic" && "bg-muted"
              )}
            >
              Basic
            </TableHead>
            <TableHead
              className={cn("text-center", currentTier === "pro" && "bg-muted")}
            >
              Pro
            </TableHead>
            <TableHead
              className={cn(
                "text-center",
                currentTier === "enterprise" && "bg-muted"
              )}
            >
              Enterprise
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{feature.name}</TableCell>
              <TableCell className="text-center">
                {renderValue(feature.basic)}
              </TableCell>
              <TableCell className="text-center">
                {renderValue(feature.pro)}
              </TableCell>
              <TableCell className="text-center">
                {renderValue(feature.enterprise)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
