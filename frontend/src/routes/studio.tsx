import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /studio redirects to /studio/discover
 */
export const Route = createFileRoute("/studio")({
  beforeLoad: () => {
    throw redirect({ to: "/studio/discover" });
  },
  component: () => null,
});
