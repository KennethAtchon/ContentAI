import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { appQueryClient } from "./app-query-client";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: { queryClient: appQueryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
