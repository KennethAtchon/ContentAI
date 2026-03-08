import { Suspense } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { PageLayout } from "@/shared/components/layout/page-layout";
import { ErrorBoundary } from "@/shared/components/layout/error-boundary";
import { Toaster } from "@/shared/components/ui/sonner";
import { useTranslation } from "react-i18next";

function RootLayout() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary>
      <Suspense
        fallback={<div className="p-6 text-center">{t("common_loading")}</div>}
      >
        <Outlet />
        <Toaster />
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFoundBoundary() {
  return (
    <PageLayout variant="public">
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-4xl font-bold">404</p>
          <p className="text-lg text-muted-foreground">Page not found</p>
        </div>
      </div>
    </PageLayout>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundBoundary,
});
