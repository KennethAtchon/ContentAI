import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  invalidateAdminNicheJobs,
  invalidateAdminNicheReelsAndNichesList,
  invalidateAdminNicheReelsForNiche,
  invalidateAdminNichesQueries,
} from "@/shared/lib/query-invalidation";
import { nichesService } from "../services/niches.service";
import type { ScrapeConfigOverride } from "../types";

export function useCreateNiche() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      isActive?: boolean;
    }) => nichesService.create(body),
    onSuccess: () => {
      void invalidateAdminNichesQueries(queryClient);
    },
  });
}

export function useUpdateNiche() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      name?: string;
      description?: string;
      isActive?: boolean;
    }) => nichesService.update(id, body),
    onSuccess: () => {
      void invalidateAdminNichesQueries(queryClient);
    },
  });
}

export function useDeleteNiche() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => nichesService.remove(id),
    onSuccess: () => {
      void invalidateAdminNichesQueries(queryClient);
    },
  });
}

export function useScanNiche() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      nicheId,
      config,
    }: {
      nicheId: number;
      config?: ScrapeConfigOverride;
    }) => nichesService.scan(nicheId, config),
    onSuccess: (_data, { nicheId }) => {
      void invalidateAdminNicheJobs(queryClient, nicheId);
    },
  });
}

export function useDedupeNiche() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nicheId: number) => nichesService.dedupe(nicheId),
    onSuccess: (_data, nicheId) => {
      void invalidateAdminNicheReelsForNiche(queryClient, nicheId);
    },
  });
}

export function useDeleteAdminReel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reelId,
      nicheId,
    }: {
      reelId: number;
      nicheId: number;
    }) => {
      await nichesService.deleteReel(reelId);
      return { reelId, nicheId };
    },
    onSuccess: ({ nicheId }) => {
      void invalidateAdminNicheReelsAndNichesList(queryClient, nicheId);
    },
  });
}
