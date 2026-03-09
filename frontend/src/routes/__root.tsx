import { Suspense } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ErrorBoundary } from "@/shared/components/layout/error-boundary";
import { Toaster } from "@/shared/components/ui/sonner";
import { useTranslation } from "react-i18next";

function RootLayout() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="h-screen bg-studio-bg flex items-center justify-center">
            <div className="studio-skeleton w-32 h-3" />
          </div>
        }
      >
        <Outlet />
        <Toaster />
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFoundBoundary() {
  const { t } = useTranslation();
  return (
    <div className="h-screen bg-studio-bg text-studio-fg font-studio flex items-center justify-center">
      <div className="text-center space-y-3">
        <span className="text-[48px] opacity-40">🔍</span>
        <p className="text-[32px] font-bold text-slate-100">404</p>
        <p className="text-[14px] text-slate-200/40">{t("common_page_not_found")}</p>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundBoundary,
});
