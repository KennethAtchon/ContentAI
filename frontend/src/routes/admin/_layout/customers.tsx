import { createFileRoute } from "@tanstack/react-router";
import { CustomersView } from "@/domains/admin/ui/customers/customers-view";
import { prefetchAdminCustomersList } from "@/app/query/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/customers")({
  loader: ({ context }) => prefetchAdminCustomersList(context.queryClient),
  component: CustomersPage,
});

function CustomersPage() {
  return <CustomersView />;
}
