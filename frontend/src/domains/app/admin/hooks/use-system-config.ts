import React, { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/app/query/query-keys";
import { invalidateAfterAdminSystemConfigSave } from "@/app/query/query-invalidation";

interface ConfigEntry {
  id: string;
  category: string;
  key: string;
  value: string | null;
  valueType: "string" | "number" | "boolean" | "json";
  isSecret: boolean;
  isActive: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

type ConfigMap = Record<string, ConfigEntry>;

export function useSystemConfig(category: string) {
  const fetcher = useQueryFetcher<ConfigEntry[]>();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.api.admin.systemConfig(category);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetcher(`/api/admin/config/${category}`),
    staleTime: 30_000,
  });

  const entries: ConfigMap = React.useMemo(() => {
    if (!data) return {};
    return (Array.isArray(data) ? data : []).reduce<ConfigMap>((acc, entry) => {
      acc[entry.key] = entry;
      return acc;
    }, {});
  }, [data]);

  const updateEntry = useCallback(
    async (key: string, value: unknown) => {
      await authenticatedFetchJson(`/api/admin/config/${category}/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      await invalidateAfterAdminSystemConfigSave(queryClient, category);
    },
    [category, authenticatedFetchJson, queryClient]
  );

  return { entries, isLoading, updateEntry };
}
