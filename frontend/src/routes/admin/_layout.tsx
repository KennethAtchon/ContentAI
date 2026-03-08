"use client";

import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/features/admin/components/dashboard/dashboard-layout";
import { AuthGuard } from "@/features/auth/components/auth-guard";

function AdminLayout() {
  return (
    <AuthGuard authType="admin">
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});
