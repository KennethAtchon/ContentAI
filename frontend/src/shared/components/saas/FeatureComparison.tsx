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
      name: "Monthly Calculations",
      basic: "50",
      pro: "500",
      enterprise: "Unlimited",
    },
    {
      name: "Mortgage Calculator",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Loan Calculator",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Investment Calculator",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "Retirement Calculator",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "Custom Calculator",
      basic: false,
      pro: false,
      enterprise: true,
    },
    {
      name: "PDF Export",
      basic: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Excel Export",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "CSV Export",
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "API Export",
      basic: false,
      pro: false,
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
