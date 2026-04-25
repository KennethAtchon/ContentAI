import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/domains/auth/ui/auth-guard";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Shield,
  Lock,
  CheckCircle2,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Badge } from "@/shared/ui/primitives/badge";
import { StudioShell } from "@/shared/ui/layout/studio-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { useTranslation } from "react-i18next";

function PaymentPage() {
  const { t } = useTranslation();

  return (
    <AuthGuard authType="user">
      <StudioShell variant="customer">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-3xl">
          <div className="mb-8">
            <Button variant="ghost" asChild>
              <Link to="/checkout">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("payment_back_to_checkout")}
              </Link>
            </Button>
          </div>

          <div className="mb-8 text-center">
            <Badge className="mb-4 bg-studio-accent/15 text-studio-accent border-primary/20 px-4 py-1.5">
              <Lock className="w-4 h-4 mr-2" />
              {t("payment_secure_payment")}
            </Badge>
            <h1 className="mb-4 text-2xl font-bold tracking-tight">
              {t("payment_complete_your_payment")}
            </h1>
            <p className="text-sm text-dim-2">
              {t("common_secure_payment_processing_powered_by_stripe")}
            </p>
          </div>

          <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-studio-accent" />
                {t("common_payment_information")}
              </CardTitle>
              <CardDescription>
                {t("common_your_payment_is_processed_securely_through_stripe")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      {t("payment_ssl_encrypted")}
                    </p>
                    <p className="text-sm text-dim-2">
                      {t("payment_bank_level_security")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      {t("payment_secure_processing_badge")}
                    </p>
                    <p className="text-sm text-dim-2">
                      {t("payment_pci_compliant")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-dashed bg-muted/30 p-12 text-center">
                <Sparkles className="mx-auto mb-4 h-12 w-12 text-dim-2" />
                <p className="mb-2 font-medium">
                  {t("common_payment_processing")}
                </p>
                <p className="text-base text-dim-2">
                  {t(
                    "common_payment_form_will_be_integrated_here_with_stripe_elements"
                  )}
                </p>
              </div>

              <div className="space-y-2 rounded-lg border bg-primary/5 p-4">
                <p className="text-base font-semibold">
                  {t("payment_your_payment_is_secure")}
                </p>
                <ul className="space-y-1 text-sm text-dim-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {t("payment_never_store_card")}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {t("payment_protected_by_stripe")}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {t("common_pci_dss_level_1_compliant")}
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudioShell>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/payment/")({
  component: PaymentPage,
});
