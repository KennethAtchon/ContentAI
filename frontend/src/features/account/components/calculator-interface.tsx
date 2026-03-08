/**
 * Calculator Interface Component
 *
 * Main calculator interface integrated into the account page.
 * Uses the same dynamic pattern as calculator-interactive.tsx for consistency.
 */

"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { FeatureGate } from "@/features/subscriptions/components/feature-gate";
import {
  getAllCalculatorConfigs,
  getCalculatorIcon,
} from "@/features/calculator/constants/calculator.constants";
import { getCalculatorComponent } from "@/features/calculator/components/calculator-component-map";
import { UpgradePrompt } from "@/features/subscriptions/components/upgrade-prompt";
import type { CalculationType } from "@/features/calculator/types/calculator.types";

export function CalculatorInterface() {
  const [selectedCalculator, setSelectedCalculator] =
    useState<CalculationType>("mortgage");

  return (
    <div className="space-y-6">
      <Tabs
        value={selectedCalculator}
        onValueChange={(value) =>
          setSelectedCalculator(value as CalculationType)
        }
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/50">
          {getAllCalculatorConfigs().map((config) => {
            const Icon = getCalculatorIcon(config.id);
            return (
              <TabsTrigger
                key={config.id}
                value={config.id}
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{config.shortName}</span>
                <span className="sm:hidden">{config.mobileLabel}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {getAllCalculatorConfigs().map((config) => {
          const CalculatorComponent = getCalculatorComponent(config.id);
          const requiredTier = config.tierRequirement;
          const Icon = getCalculatorIcon(config.id);

          return (
            <TabsContent key={config.id} value={config.id} className="mt-6">
              <FeatureGate
                requiredTier={requiredTier}
                fallback={
                  <UpgradePrompt
                    requiredTier={requiredTier}
                    featureName={config.name}
                    featureDescription={config.longDescription}
                    icon={Icon}
                  />
                }
              >
                <CalculatorComponent />
              </FeatureGate>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
