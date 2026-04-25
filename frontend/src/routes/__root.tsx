import { Suspense } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  HeadContent,
} from "@tanstack/react-router";
import { ErrorBoundary } from "@/shared/ui/layout/error-boundary";
import { Toaster } from "@/shared/ui/primitives/sonner";
import { DebugControlPanel } from "@/shared/debug/ui/debug-control-panel";
import { useTranslation } from "react-i18next";

function RootLayout() {
  return (
    <ErrorBoundary>
      <HeadContent />
      <Suspense
        fallback={
          <div className="h-screen bg-studio-bg flex items-center justify-center">
            <div className="studio-skeleton w-32 h-3" />
          </div>
        }
      >
        <Outlet />
        <Toaster />
        <DebugControlPanel />
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFoundBoundary() {
  const { t } = useTranslation();
  return (
    <div className="h-screen bg-studio-bg text-studio-fg font-studio flex items-center justify-center">
      <div className="text-center space-y-3">
        <span className="text-6xl opacity-40">🔍</span>
        <p className="text-4xl font-bold text-primary">404</p>
        <p className="text-base text-dim-2">{t("common_page_not_found")}</p>
      </div>
    </div>
  );
}

export interface AppRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundBoundary,
});
