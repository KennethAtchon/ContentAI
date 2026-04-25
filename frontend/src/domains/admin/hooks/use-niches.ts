import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { nichesService } from "../api/niches.service";
import type { NicheReelsParams } from "../model";
import {
  useCreateNiche,
  useDeleteAdminReel,
  useDeleteNiche,
  useDedupeNiche,
  useScanNiche,
  useUpdateNiche,
} from "./use-niche-mutations";

export type {
  JobStatus,
  ScrapeJob,
  AdminNiche,
  AdminNicheReel,
  NicheReelsResponse,
  NicheReelsParams,
  ScrapeConfigOverride,
} from "../model";

export {
  useCreateNiche,
  useUpdateNiche,
  useDeleteNiche,
  useScanNiche,
  useDedupeNiche,
  useDeleteAdminReel,
};

export function useNiches(params?: { search?: string; active?: boolean }) {
  return useQuery({
    queryKey: queryKeys.api.admin.niches(params),
    queryFn: () => nichesService.list(params),
  });
}

export function useNicheReels(nicheId: number, params: NicheReelsParams = {}) {
  const { page = 1, limit = 50 } = params;
  return useQuery({
    queryKey: queryKeys.api.admin.nicheReels(nicheId, { page, limit }),
    queryFn: () => nichesService.listReels(nicheId, params),
    enabled: nicheId > 0,
  });
}

export function useNicheJobs(nicheId: number) {
  return useQuery({
    queryKey: queryKeys.api.admin.nicheJobs(nicheId),
    queryFn: () => nichesService.listJobs(nicheId),
    enabled: nicheId > 0,
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const hasActive = jobs.some(
        (job) => job.status === "queued" || job.status === "running"
      );
      return hasActive ? 3000 : false;
    },
  });
}
