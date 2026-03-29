import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/features/admin/components/dashboard/dashboard-view";
import { prefetchAdminDashboard } from "@/shared/lib/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/dashboard")({
  loader: ({ context }) => prefetchAdminDashboard(context.queryClient),
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardView />;
}
