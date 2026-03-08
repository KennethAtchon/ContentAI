import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { Section } from "@/shared/components/custom-ui/section";
import { CalculatorInteractive } from "@/routes/(customer)/calculator/-calculator-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useTranslation } from "react-i18next";

function CalculatorPage() {
  const { t } = useTranslation();

  return (
    <AuthGuard authType="user">
      <PageLayout variant="customer">
        <Section maxWidth="7xl" padding="sm">
          <div className="mb-8 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  {t("common_financial_calculators")}
                </h1>
                <p className="text-lg text-muted-foreground mt-1">
                  {t("metadata_calculator_description")}
                </p>
              </div>
            </div>
          </div>

          <CalculatorInteractive />
        </Section>
      </PageLayout>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/calculator")({
  component: CalculatorPage,
});
