import { ScopedErrorBoundary } from "@/shared/components/layout/error-boundary";

export function AuthRouteBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScopedErrorBoundary
      title="Something went wrong in Auth"
      description="Refresh the page to retry signing in."
      className="min-h-screen"
    >
      {children}
    </ScopedErrorBoundary>
  );
}
