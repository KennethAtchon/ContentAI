import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { Section } from "@/shared/components/custom-ui/section";
import { AccountInteractive } from "@/routes/(customer)/account/-account-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useTranslation } from "react-i18next";

function AccountPage() {
  const { t } = useTranslation();

  return (
    <AuthGuard authType="user">
      <PageLayout variant="customer">
        <Section maxWidth="7xl" padding="sm">
          <div className="mb-8 space-y-2">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              {t("common_account_dashboard")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t(
                "common_manage_your_subscription_view_usage_and_access_calculators"
              )}
            </p>
          </div>

          <AccountInteractive />
        </Section>
      </PageLayout>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/account")({
  component: AccountPage,
});
