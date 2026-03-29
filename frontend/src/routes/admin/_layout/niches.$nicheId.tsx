import { createFileRoute } from "@tanstack/react-router";
import { NicheDetailView } from "@/features/admin/components/niches/NicheDetailView";

export const Route = createFileRoute("/admin/_layout/niches/$nicheId")({
  head: ({ params }) => ({
    meta: [{ title: `Niche #${params.nicheId} — Admin` }],
  }),
  component: NicheDetailPage,
});

function NicheDetailPage() {
  const { nicheId: nicheIdStr } = Route.useParams();
  return <NicheDetailView nicheId={parseInt(nicheIdStr, 10)} />;
}
