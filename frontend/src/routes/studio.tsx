import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /studio/*
 * Just renders children — no redirect here.
 * Use studio/index.tsx to redirect /studio → /studio/discover
 */
export const Route = createFileRoute("/studio")({
  component: () => <Outlet />,
});
