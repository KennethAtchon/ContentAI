import { createFileRoute } from "@tanstack/react-router";
import { SystemConfigView } from "@/domains/admin/ui/system-config/SystemConfigView";

export const Route = createFileRoute("/admin/_layout/system-config")({
  component: SystemConfigPage,
});

function SystemConfigPage() {
  return <SystemConfigView />;
}
