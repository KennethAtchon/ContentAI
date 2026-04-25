import { createFileRoute } from "@tanstack/react-router";
import { CheckoutInteractive } from "@/routes/(customer)/checkout/-checkout-interactive";
import { AuthGuard } from "@/domains/auth/ui/auth-guard";
import { StudioShell } from "@/app/layout/studio-shell";

function CheckoutPage() {
  return (
    <AuthGuard authType="user">
      <StudioShell variant="customer">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
          <CheckoutInteractive />
        </div>
      </StudioShell>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/checkout")({
  component: CheckoutPage,
});
