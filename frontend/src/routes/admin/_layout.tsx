"use client";

import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/features/admin/components/dashboard/dashboard-layout";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ScopedErrorBoundary } from "@/shared/components/layout/error-boundary";

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
