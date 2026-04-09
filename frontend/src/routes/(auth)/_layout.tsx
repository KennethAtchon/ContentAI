import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ScopedErrorBoundary } from "@/shared/components/layout/error-boundary";

function AuthLayout() {
  return (
    <ScopedErrorBoundary
      title="Something went wrong in Auth"
      description="Refresh the page to retry signing in."
      className="min-h-screen"
    >
      <Outlet />
    </ScopedErrorBoundary>
  );
}

export const Route = createFileRoute("/(auth)/_layout")({
  component: AuthLayout,
});
