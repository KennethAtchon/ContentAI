import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/domains/admin/ui/dashboard/dashboard-view";
import { prefetchAdminDashboard } from "@/app/query/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/dashboard")({
  loader: ({ context }) => prefetchAdminDashboard(context.queryClient),
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardView />;
}
