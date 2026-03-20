import { createFileRoute } from "@tanstack/react-router";
import { AccountInteractive } from "@/routes/(customer)/account/-account-interactive";
import { AuthGuard } from "@/features/auth/components/auth-guard";

function AccountPage() {
  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio overflow-hidden">
        <AccountInteractive />
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/(customer)/account")({
  component: AccountPage,
});
