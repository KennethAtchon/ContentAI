import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { cn } from "@/shared/lib/utils";
import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { Section } from "../components/Section";
import { TabSkeleton } from "../components/TabSkeleton";
import { ConfigTextField } from "../components/ConfigTextField";
import { ConfigNumberField } from "../components/ConfigNumberField";
import { ConfigSelectField } from "../components/ConfigSelectField";
import { ProviderPriorityList } from "../components/ProviderPriorityList";
import { ProviderStatusBadge } from "../components/ProviderStatusBadge";
import type { VideoProvidersStatusResponse } from "../types";

function VideoProviderOverview() {
  const fetcher = useQueryFetcher<VideoProvidersStatusResponse>();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.admin.videoProvidersStatus(),
    queryFn: () => fetcher("/api/admin/config/video-providers/status"),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-overlay-sm bg-studio-surface overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-overlay-sm h-11 bg-overlay-xs" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="px-4 py-3 h-14 border-b border-overlay-sm last:border-0"
          >
            <div className="h-4 w-32 bg-overlay-sm rounded mb-2" />
            <div className="h-3 w-48 bg-overlay-xs rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { providers, defaultProvider, configuredDefault } = data;
  const activeCount = providers.filter((p) => p.active).length;

  return (
    <div className="rounded-xl border border-overlay-sm bg-studio-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-overlay-sm">
        <p className="text-sm font-semibold text-studio-fg">Provider Status</p>
        <span className="text-xs text-dim-3">
          {activeCount} of {providers.length} active
        </span>
      </div>
      <div className="divide-y divide-overlay-sm">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3",
              !provider.active && "opacity-50"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-studio-fg">
                  {provider.label}
                </span>
                <ProviderStatusBadge active={provider.active} />
                {provider.id === configuredDefault && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      provider.id === defaultProvider
                        ? "text-studio-accent"
                        : "text-dim-3"
                    )}
                  >
                    {provider.id === defaultProvider
                      ? "default"
                      : "configured default — unavailable"}
                  </span>
                )}
              </div>
              {provider.active && (
                <p className="text-xs text-dim-2 mt-1">
                  <span className="text-dim-3">Model —</span>{" "}
                  <span className="font-mono">{provider.model}</span>
                </p>
              )}
              {!provider.active && (
                <p className="text-xs text-dim-3 mt-1">
                  Configure an API key in the{" "}
                  <span className="font-medium">API Keys</span> tab to activate
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VideoTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("video");
  const fetcher = useQueryFetcher<VideoProvidersStatusResponse>();
  const { data: statusData } = useQuery({
    queryKey: queryKeys.api.admin.videoProvidersStatus(),
    queryFn: () => fetcher("/api/admin/config/video-providers/status"),
    staleTime: 30_000,
  });

  const getStr = (key: string) => entries[key]?.value ?? "";
  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;
  const getJson = <T,>(key: string, fallback: T): T => {
    try {
      return entries[key]?.value
        ? (JSON.parse(entries[key]!.value!) as T)
        : fallback;
    } catch {
      return fallback;
    }
  };

  if (isLoading) return <TabSkeleton />;

  const providerStatus = statusData
    ? Object.fromEntries(statusData.providers.map((p) => [p.id, p.active]))
    : undefined;

  return (
    <div className="space-y-5">
      <VideoProviderOverview />

      <Section title="Provider Settings">
        <ConfigSelectField
          label="Default Provider"
          value={getStr("default_provider") || "kling-fal"}
          onSave={(v) => updateEntry("default_provider", v)}
          options={[
            { value: "kling-fal", label: "Kling (via Fal.ai)" },
            { value: "runway", label: "Runway" },
            { value: "image-ken-burns", label: "Image + Ken Burns" },
          ]}
        />
        <ProviderPriorityList
          label="Fallback Order"
          description="Order to try providers when the default is unavailable"
          items={getJson<string[]>("fallback_order", [
            "kling-fal",
            "image-ken-burns",
            "runway",
          ])}
          displayNames={{
            "kling-fal": "Kling (via Fal.ai)",
            runway: "Runway",
            "image-ken-burns": "Image + Ken Burns",
          }}
          providerStatus={providerStatus}
          onSave={(items) => updateEntry("fallback_order", items)}
        />
      </Section>

      <Section title="Shot Duration">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Min Duration"
            value={getNum("shot_min_duration_seconds")}
            onSave={(v) => updateEntry("shot_min_duration_seconds", v)}
            min={1}
            suffix="sec"
          />
          <ConfigNumberField
            label="Max Duration"
            value={getNum("shot_max_duration_seconds")}
            onSave={(v) => updateEntry("shot_max_duration_seconds", v)}
            min={1}
            suffix="sec"
          />
        </div>
      </Section>

      <Section title="Timeline & Pacing">
        <ConfigNumberField
          label="Timeline Max Duration"
          value={getNum("timeline_max_duration_ms")}
          onSave={(v) => updateEntry("timeline_max_duration_ms", v)}
          min={1000}
          suffix="ms"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Clip Pacing Min"
            value={getNum("clip_pacing_min_ms")}
            onSave={(v) => updateEntry("clip_pacing_min_ms", v)}
            min={0}
            suffix="ms"
          />
          <ConfigNumberField
            label="Clip Pacing Max"
            value={getNum("clip_pacing_max_ms")}
            onSave={(v) => updateEntry("clip_pacing_max_ms", v)}
            min={0}
            suffix="ms"
          />
        </div>
      </Section>

      <Section
        title="Model Configuration"
        description="Models used by each provider when generating video."
      >
        <ConfigSelectField
          label="Runway Model"
          value={getStr("runway_model") || "gen3a_turbo"}
          onSave={(v) => updateEntry("runway_model", v)}
          options={[
            { value: "gen3a_turbo", label: "Gen3A Turbo (faster, cheaper)" },
            { value: "gen3a", label: "Gen3A (higher quality)" },
          ]}
        />
        <ConfigTextField
          label="Kling Model"
          value={getStr("kling_model")}
          onSave={(v) => updateEntry("kling_model", v)}
          placeholder="fal-ai/kling-video/v2.1/standard/text-to-video"
        />
        <ConfigTextField
          label="FLUX Model"
          description="Used by the Image + Ken Burns provider"
          value={getStr("flux_model")}
          onSave={(v) => updateEntry("flux_model", v)}
          placeholder="fal-ai/flux/schnell"
        />
      </Section>
    </div>
  );
}
