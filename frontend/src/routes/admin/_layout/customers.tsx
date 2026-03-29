import { createFileRoute } from "@tanstack/react-router";
import { CustomersView } from "@/features/admin/components/customers/customers-view";
import { prefetchAdminCustomersList } from "@/shared/lib/route-data-prefetch";

export const Route = createFileRoute("/admin/_layout/customers")({
  loader: ({ context }) =>
    prefetchAdminCustomersList(context.queryClient),
  component: CustomersPage,
});

function CustomersPage() {
  return <CustomersView />;
}
