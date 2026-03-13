import { createFileRoute } from "@tanstack/react-router";
import AdminVerifyPage from "./-verify";

export const Route = createFileRoute("/admin/verify/")({
  component: AdminVerifyPage,
});
