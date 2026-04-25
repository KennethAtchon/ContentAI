"use client";

import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/domains/admin/ui/dashboard/dashboard-layout";
import { AuthGuard } from "@/domains/auth/ui/auth-guard";
import { ScopedErrorBoundary } from "@/shared/ui/layout/error-boundary";

function AdminLayout() {
  return (
    <AuthGuard authType="admin">
      <DashboardLayout>
        <ScopedErrorBoundary
          title="Something went wrong in Admin"
          description="Refresh the page to retry this admin screen."
          className="h-full"
        >
          <Outlet />
        </ScopedErrorBoundary>
      </DashboardLayout>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});
