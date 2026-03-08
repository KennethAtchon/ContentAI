import { createFileRoute } from "@tanstack/react-router";
import { PaymentSuccessInteractive } from "@/routes/(customer)/payment/success/-payment-success-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { PageLayout } from "@/shared/components/layout/page-layout";

function PaymentSuccessPage() {
  return (
    <AuthGuard authType="user">
      <PageLayout variant="customer">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <PaymentSuccessInteractive />
        </div>
      </PageLayout>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/payment/success/")({
  component: PaymentSuccessPage,
});
