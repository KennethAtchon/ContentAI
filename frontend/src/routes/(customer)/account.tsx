import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import { AccountInteractive } from "@/routes/(customer)/account/-account-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useTranslation } from "react-i18next";

function AccountPage() {
  const { t } = useTranslation();

  return (
    <AuthGuard authType="user">
      <StudioShell variant="customer">
        <StudioSection maxWidth="7xl" padding="sm">
          <div className="mb-8 space-y-2">
            <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
              {t("common_account_dashboard")}
            </h1>
            <p className="text-xl text-dim-2">
              {t(
                "common_manage_your_subscription_view_usage_and_access_studio"
              )}
            </p>
          </div>

          <AccountInteractive />
        </StudioSection>
      </StudioShell>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/account")({
  component: AccountPage,
});
