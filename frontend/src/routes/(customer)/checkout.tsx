import { createFileRoute } from "@tanstack/react-router";
import { CheckoutInteractive } from "@/routes/(customer)/checkout/-checkout-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { PageLayout } from "@/shared/components/layout/page-layout";

function CheckoutPage() {
  return (
    <AuthGuard authType="user">
      <PageLayout variant="customer">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
          <CheckoutInteractive />
        </div>
      </PageLayout>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/checkout")({
  component: CheckoutPage,
});
