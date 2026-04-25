import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/domains/auth/ui/auth-guard";
import { Card, CardContent } from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import { XCircle, ArrowLeft, HelpCircle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { StudioShell } from "@/shared/ui/layout/studio-shell";
import { useTranslation } from "react-i18next";

function PaymentCancelPage() {
  const { t } = useTranslation();

  return (
    <AuthGuard authType="user">
      <StudioShell variant="customer">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <Card className="border-2 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <CardContent className="p-12 text-center">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
                  <XCircle className="h-12 w-12 text-warning" />
                </div>
                <h1 className="mb-4 text-2xl font-bold tracking-tight">
                  {t("metadata_payment_cancel_title")}
                </h1>
                <p className="mb-8 text-sm text-dim-2">
                  {t(
                    "common_no_charges_were_made_your_subscription_was_not_activated"
                  )}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Button asChild size="lg" className="h-12 shadow-lg">
                    <Link to="/pricing">
                      <ArrowLeft className="mr-2 h-5 w-5" />
                      {t("payment_cancel_back_to_pricing")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-12 border-2"
                  >
                    <Link to="/contact">
                      {t("payment_cancel_need_help")}
                      <HelpCircle className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6 border-2">
              <CardContent className="p-6">
                <h2 className="mb-4 text-2xl font-semibold">
                  {t("payment_cancel_have_questions")}
                </h2>
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-2 font-medium">
                      {t("payment_cancel_free_trial_title")}
                    </p>
                    <p className="text-base text-dim-2">
                      {t("payment_cancel_free_trial_description")}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-2 font-medium">
                      {t("payment_cancel_cancel_anytime_title")}
                    </p>
                    <p className="text-base text-dim-2">
                      {t("payment_cancel_cancel_anytime_description")}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-2 font-medium">
                      {t("payment_cancel_guarantee_title")}
                    </p>
                    <p className="text-base text-dim-2">
                      {t("payment_cancel_guarantee_description")}
                    </p>
                  </div>
                </div>
                <Button asChild className="mt-6 w-full" variant="outline">
                  <Link to="/pricing">
                    {t("payment_cancel_view_plans")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </StudioShell>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/payment/cancel")({
  component: PaymentCancelPage,
});
