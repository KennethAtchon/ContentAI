import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { cn } from "@/shared/lib/utils";
import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { Section } from "../components/Section";
import { TabSkeleton } from "../components/TabSkeleton";
import { ConfigTextField } from "../components/ConfigTextField";
import { ConfigNumberField } from "../components/ConfigNumberField";
import { ProviderPriorityList } from "../components/ProviderPriorityList";
import { ProviderStatusBadge } from "../components/ProviderStatusBadge";
import type { AiProvidersStatusResponse } from "../types";

function AiProviderOverview() {
  const fetcher = useQueryFetcher<AiProvidersStatusResponse>();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.admin.aiProvidersStatus(),
    queryFn: () => fetcher("/api/admin/config/ai-providers/status"),
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

  const { providers, defaultProvider } = data;
  const activeCount = providers.filter((p) => p.active).length;
  const singleModelProviders = new Set(["openai", "openrouter"]);

  return (
    <div className="rounded-xl border border-overlay-sm bg-studio-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-overlay-sm">
        <p className="text-sm font-semibold text-studio-fg">Provider Status</p>
        <span className="text-xs text-dim-3">
          {activeCount} of {providers.length} active
        </span>
      </div>
      <div className="divide-y divide-overlay-sm">
        {providers.map((provider, idx) => (
          <div
            key={provider.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3",
              !provider.active && "opacity-50"
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-studio-accent/20 text-xs font-bold text-studio-accent shrink-0 mt-0.5">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-studio-fg">
                  {provider.label}
                </span>
                <ProviderStatusBadge active={provider.active} />
                {provider.id === defaultProvider && provider.active && (
                  <span className="text-xs text-studio-accent font-medium">
                    default
                  </span>
                )}
              </div>
              {provider.active && (
                <div className="mt-1.5 space-y-0.5">
                  {singleModelProviders.has(provider.id) ? (
                    <p className="text-xs text-dim-2">
                      <span className="text-dim-3">Model —</span>{" "}
                      <span className="font-mono">
                        {provider.analysisModel}
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-dim-2">
                        <span className="text-dim-3">Analysis —</span>{" "}
                        <span className="font-mono">
                          {provider.analysisModel}
                        </span>
                      </p>
                      <p className="text-xs text-dim-2">
                        <span className="text-dim-3">Generation —</span>{" "}
                        <span className="font-mono">
                          {provider.generationModel}
                        </span>
                      </p>
                    </>
                  )}
                </div>
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

function AiTabContent({
  priorityOrder,
  getStr,
  getNum,
  updateEntry,
}: {
  priorityOrder: string[];
  getStr: (key: string) => string;
  getNum: (key: string) => number;
  updateEntry: (key: string, value: unknown) => Promise<void>;
}) {
  const fetcher = useQueryFetcher<AiProvidersStatusResponse>();
  const { data: statusData } = useQuery({
    queryKey: queryKeys.api.admin.aiProvidersStatus(),
    queryFn: () => fetcher("/api/admin/config/ai-providers/status"),
    staleTime: 30_000,
  });

  const providerStatus: Record<string, boolean> = useMemo(() => {
    if (!statusData) return {};
    return Object.fromEntries(
      statusData.providers.map((p) => [p.id, p.active])
    );
  }, [statusData]);

  return (
    <div className="space-y-5">
      <AiProviderOverview />

      <Section
        title="Provider Priority"
        description="First available provider is used. Use arrows to reorder."
      >
        <ProviderPriorityList
          label="Provider Order"
          items={priorityOrder}
          displayNames={{
            openai: "OpenAI",
            claude: "Claude (Anthropic)",
            openrouter: "OpenRouter",
          }}
          providerStatus={statusData ? providerStatus : undefined}
          onSave={(items) => updateEntry("provider_priority", items)}
        />
      </Section>

      <Section
        title="Claude Models"
        headerRight={
          statusData ? (
            <ProviderStatusBadge active={providerStatus.claude ?? false} />
          ) : undefined
        }
      >
        <ConfigTextField
          label="Analysis Model"
          description="Fast/cheap model for reel analysis tasks"
          value={getStr("claude_analysis_model")}
          onSave={(v) => updateEntry("claude_analysis_model", v)}
          placeholder="claude-haiku-4-5-20251001"
        />
        <ConfigTextField
          label="Generation Model"
          description="Smart/expensive model for content generation"
          value={getStr("claude_generation_model")}
          onSave={(v) => updateEntry("claude_generation_model", v)}
          placeholder="claude-sonnet-4-6"
        />
      </Section>

      <Section
        title="OpenAI"
        headerRight={
          statusData ? (
            <ProviderStatusBadge active={providerStatus.openai ?? false} />
          ) : undefined
        }
      >
        <ConfigTextField
          label="Model"
          value={getStr("openai_model")}
          onSave={(v) => updateEntry("openai_model", v)}
          placeholder="gpt-4o-mini"
        />
      </Section>

      <Section
        title="OpenRouter"
        headerRight={
          statusData ? (
            <ProviderStatusBadge active={providerStatus.openrouter ?? false} />
          ) : undefined
        }
      >
        <ConfigTextField
          label="Model"
          value={getStr("openrouter_model")}
          onSave={(v) => updateEntry("openrouter_model", v)}
          placeholder="google/gemma-4-31b-it"
        />
      </Section>

      <Section title="Token Limits">
        <ConfigNumberField
          label="Max Tokens"
          value={getNum("max_tokens")}
          onSave={(v) => updateEntry("max_tokens", v)}
          min={100}
          max={200000}
          suffix="tokens"
        />
      </Section>
    </div>
  );
}

export function AiTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("ai");

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

  const priorityOrder = getJson<string[]>("provider_priority", [
    "openrouter",
    "openai",
    "claude",
  ]);

  return (
    <AiTabContent
      priorityOrder={priorityOrder}
      getStr={getStr}
      getNum={getNum}
      updateEntry={updateEntry}
    />
  );
}
