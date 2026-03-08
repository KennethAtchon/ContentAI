import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/features/admin/components/dashboard/dashboard-view";

export const Route = createFileRoute("/admin/_layout/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardView />;
}
