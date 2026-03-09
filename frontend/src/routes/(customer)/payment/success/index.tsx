import { createFileRoute } from "@tanstack/react-router";
import { PaymentSuccessInteractive } from "@/routes/(customer)/payment/success/-payment-success-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioShell } from "@/shared/components/layout/studio-shell";

function PaymentSuccessPage() {
  return (
    <AuthGuard authType="user">
      <StudioShell variant="customer">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <PaymentSuccessInteractive />
        </div>
      </StudioShell>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/payment/success/")({
  component: PaymentSuccessPage,
});
