import React, { useState, useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/utils/helpers/utils";

export const Route = createFileRoute("/admin/_layout/system-config")({
  component: SystemConfigPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface TtsVoice {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  description: string;
  elevenLabsId: string;
}

interface VoiceFormState {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  description: string;
  elevenLabsId: string;
}

// ── Core hook ─────────────────────────────────────────────────────────────────

function useSystemConfig(category: string) {
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
      await queryClient.invalidateQueries({ queryKey });
    },
    [category, authenticatedFetchJson, queryClient]
  );

  return { entries, isLoading, updateEntry };
}

// ── Shared field components ───────────────────────────────────────────────────

function SaveButton({
  saving,
  saved,
  onClick,
  disabled,
}: {
  saving: boolean;
  saved: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={saving || disabled}
      className={cn(
        "min-w-[80px] shrink-0 transition-all",
        saved && "bg-green-500/20 text-green-400 border-green-500/30"
      )}
      variant={saved ? "outline" : "default"}
    >
      {saving ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          {t("admin_config_saving")}
        </>
      ) : saved ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          {t("admin_config_saved")}
        </>
      ) : (
        t("admin_config_save")
      )}
    </Button>
  );
}

function ConfigTextField({
  label,
  description,
  value: initialValue,
  onSave,
  type = "text",
  placeholder,
  prefix,
}: {
  label: string;
  description?: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  type?: string;
  placeholder?: string;
  prefix?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-studio-fg">{label}</Label>
      {description && <p className="text-xs text-dim-3">{description}</p>}
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground shrink-0">
            {prefix}
          </span>
        )}
        <Input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={cn("flex-1", prefix && "rounded-l-none")}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>
    </div>
  );
}

function ConfigNumberField({
  label,
  description,
  value: initialValue,
  onSave,
  min,
  max,
  suffix,
  prefix,
}: {
  label: string;
  description?: string;
  value: number;
  onSave: (val: number) => Promise<void>;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(String(initialValue)), [initialValue]);

  const handleSave = async () => {
    const num = Number(value);
    if (isNaN(num)) {
      toast.error("Invalid number");
      return;
    }
    setSaving(true);
    try {
      await onSave(num);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-studio-fg">{label}</Label>
      {description && <p className="text-xs text-dim-3">{description}</p>}
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground shrink-0">
            {prefix}
          </span>
        )}
        <div className="relative flex-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={min}
            max={max}
            className={cn(suffix && "pr-14", prefix && "rounded-l-none")}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim-3 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>
    </div>
  );
}

function ConfigSelectField({
  label,
  description,
  value: initialValue,
  onSave,
  options,
}: {
  label: string;
  description?: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleChange = async (newVal: string) => {
    setValue(newVal);
    setSaving(true);
    try {
      await onSave(newVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-studio-fg">{label}</Label>
      {description && <p className="text-xs text-dim-3">{description}</p>}
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && (
          <Loader2 className="h-4 w-4 animate-spin text-dim-3 shrink-0" />
        )}
        {saved && !saving && (
          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
        )}
      </div>
    </div>
  );
}

function ConfigSwitchField({
  label,
  description,
  value: initialValue,
  onSave,
}: {
  label: string;
  description?: string;
  value: boolean;
  onSave: (val: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleChange = async (checked: boolean) => {
    setValue(checked);
    setSaving(true);
    try {
      await onSave(checked);
      toast.success(`${label} ${checked ? "enabled" : "disabled"}`);
    } catch {
      setValue(!checked);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-overlay-sm bg-overlay-xs px-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <Label className="text-sm font-medium text-studio-fg cursor-pointer leading-none">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-dim-3 mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-dim-3" />}
        <Switch
          checked={value}
          onCheckedChange={handleChange}
          disabled={saving}
        />
      </div>
    </div>
  );
}

function ProviderPriorityList({
  label,
  description,
  items: initialItems,
  onSave,
  displayNames,
}: {
  label: string;
  description?: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
  displayNames?: Record<string, string>;
}) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const serialized = JSON.stringify(initialItems);

  useEffect(() => {
    try {
      setItems(JSON.parse(serialized) as string[]);
    } catch {
      // ignore
    }
  }, [serialized]);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-studio-fg">{label}</Label>
      {description && <p className="text-xs text-dim-3">{description}</p>}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-lg border border-overlay-sm bg-overlay-xs px-3 py-2.5"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-studio-accent/20 text-xs font-bold text-studio-accent shrink-0">
              {idx + 1}
            </span>
            <span className="flex-1 text-sm font-medium text-studio-fg">
              {displayNames?.[item] ?? item}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-dim-3 hover:text-studio-fg"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-dim-3 hover:text-studio-fg"
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-overlay-sm bg-studio-surface">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-studio-fg">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-sm text-dim-2">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-overlay-sm p-6 space-y-4"
        >
          <div className="h-4 w-40 bg-overlay-sm rounded" />
          <div className="h-9 w-full bg-overlay-sm rounded-md" />
          <div className="h-9 w-full bg-overlay-sm rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ── AI Tab ────────────────────────────────────────────────────────────────────

function AiTab() {
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

  return (
    <div className="space-y-5">
      <Section
        title="Provider Priority"
        description="First available provider is used. Use arrows to reorder."
      >
        <ProviderPriorityList
          label="Provider Order"
          items={getJson<string[]>("provider_priority", [
            "openai",
            "claude",
            "openrouter",
          ])}
          displayNames={{
            openai: "OpenAI",
            claude: "Claude (Anthropic)",
            openrouter: "OpenRouter",
          }}
          onSave={(items) => updateEntry("provider_priority", items)}
        />
      </Section>

      <Section title="Claude Models">
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

      <Section title="OpenAI">
        <ConfigTextField
          label="Model"
          value={getStr("openai_model")}
          onSave={(v) => updateEntry("openai_model", v)}
          placeholder="gpt-4o-mini"
        />
      </Section>

      <Section title="OpenRouter">
        <ConfigTextField
          label="Model"
          value={getStr("openrouter_model")}
          onSave={(v) => updateEntry("openrouter_model", v)}
          placeholder="openai/gpt-4o-mini"
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

// ── Video Tab ─────────────────────────────────────────────────────────────────

function VideoTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("video");

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

  return (
    <div className="space-y-5">
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

      <Section title="Model Configuration">
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

// ── Subscription Tab ──────────────────────────────────────────────────────────

function SubscriptionTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("subscription");

  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section title="Trial Period">
        <ConfigNumberField
          label="Trial Days"
          description="Number of free trial days for new subscriptions"
          value={getNum("trial_days")}
          onSave={(v) => updateEntry("trial_days", v)}
          min={0}
          max={365}
          suffix="days"
        />
      </Section>

      <Section
        title="Free Tier"
        description="Limits for users without an active subscription"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Generations / Month"
            value={getNum("free_generations_per_month")}
            onSave={(v) => updateEntry("free_generations_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Analyses / Month"
            value={getNum("free_analyses_per_month")}
            onSave={(v) => updateEntry("free_analyses_per_month", v)}
            min={0}
          />
        </div>
      </Section>

      <Section title="Creator Tier">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Max Reels / Month"
            value={getNum("basic_max_reels_per_month")}
            onSave={(v) => updateEntry("basic_max_reels_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Generations / Month"
            value={getNum("basic_generations_per_month")}
            onSave={(v) => updateEntry("basic_generations_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Analyses / Month"
            value={getNum("basic_analyses_per_month")}
            onSave={(v) => updateEntry("basic_analyses_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Max Queue Items"
            value={getNum("basic_max_queue_items")}
            onSave={(v) => updateEntry("basic_max_queue_items", v)}
            min={0}
          />
        </div>
      </Section>

      <Section title="Pro Tier">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Generations / Month"
            description="-1 = unlimited"
            value={getNum("pro_generations_per_month")}
            onSave={(v) => updateEntry("pro_generations_per_month", v)}
            min={-1}
          />
          <ConfigNumberField
            label="Analyses / Month"
            description="-1 = unlimited"
            value={getNum("pro_analyses_per_month")}
            onSave={(v) => updateEntry("pro_analyses_per_month", v)}
            min={-1}
          />
          <ConfigNumberField
            label="Max Queue Items"
            description="-1 = unlimited"
            value={getNum("pro_max_queue_items")}
            onSave={(v) => updateEntry("pro_max_queue_items", v)}
            min={-1}
          />
        </div>
      </Section>

      <Section
        title="Agency (Enterprise) Tier"
        description="All limits are -1 (unlimited) by design."
      >
        <div className="flex flex-wrap gap-2">
          {["Generations", "Analyses", "Queue Items", "Reels"].map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg border border-overlay-sm bg-overlay-xs px-3 py-2"
            >
              <span className="text-sm text-studio-fg">{name}</span>
              <Badge
                variant="secondary"
                className="text-xs bg-studio-accent/10 text-studio-accent border-studio-accent/20"
              >
                Unlimited
              </Badge>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Feature Flags Tab ─────────────────────────────────────────────────────────

function FeatureFlagsTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("feature_flags");
  const getBool = (key: string) => entries[key]?.value === "true";

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section
        title="Feature Flags"
        description="Changes take effect immediately without redeployment."
      >
        <div className="space-y-2.5">
          <ConfigSwitchField
            label="Cron Jobs"
            description="Enable background scheduled jobs (scraping, analytics, cleanup)"
            value={getBool("cron_jobs_enabled")}
            onSave={(v) => updateEntry("cron_jobs_enabled", v)}
          />
          <ConfigSwitchField
            label="Prometheus Metrics"
            description="Expose /metrics endpoint for Prometheus scraping"
            value={getBool("metrics_enabled")}
            onSave={(v) => updateEntry("metrics_enabled", v)}
          />
          <ConfigSwitchField
            label="Debug Logging"
            description="Verbose server logs — avoid enabling in production long-term"
            value={getBool("debug_enabled")}
            onSave={(v) => updateEntry("debug_enabled", v)}
          />
          <ConfigSwitchField
            label="Mock Reel Scrape (Dev)"
            description="Return fake reel data instead of calling Instagram API"
            value={getBool("mock_reel_scrape")}
            onSave={(v) => updateEntry("mock_reel_scrape", v)}
          />
          <ConfigSwitchField
            label="DB Health Checks"
            description="Run periodic database health checks and connection validation"
            value={getBool("db_health_checks_enabled")}
            onSave={(v) => updateEntry("db_health_checks_enabled", v)}
          />
        </div>
      </Section>
    </div>
  );
}

// ── Content Tab ───────────────────────────────────────────────────────────────

function ContentTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("content");
  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section
        title="Viral Thresholds"
        description="Thresholds used to classify content as viral."
      >
        <ConfigNumberField
          label="Viral Views Threshold"
          description="Minimum view count for a reel to be classified as viral"
          value={getNum("viral_views_threshold")}
          onSave={(v) => updateEntry("viral_views_threshold", v)}
          min={0}
          suffix="views"
        />
      </Section>
    </div>
  );
}

// ── TTS Tab ───────────────────────────────────────────────────────────────────

const BLANK_VOICE: VoiceFormState = {
  id: "",
  name: "",
  gender: "neutral",
  description: "",
  elevenLabsId: "",
};

function VoiceFormFields({
  form,
  onChange,
}: {
  form: VoiceFormState;
  onChange: (form: VoiceFormState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          ID <span className="text-red-400">*</span>
        </Label>
        <Input
          value={form.id}
          onChange={(e) => onChange({ ...form, id: e.target.value })}
          placeholder="e.g. rachel-v1"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          Name <span className="text-red-400">*</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Rachel"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          Gender
        </Label>
        <Select
          value={form.gender}
          onValueChange={(v) =>
            onChange({ ...form, gender: v as VoiceFormState["gender"] })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          ElevenLabs ID <span className="text-red-400">*</span>
        </Label>
        <Input
          value={form.elevenLabsId}
          onChange={(e) => onChange({ ...form, elevenLabsId: e.target.value })}
          placeholder="ElevenLabs voice ID"
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          Description
        </Label>
        <Input
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Brief description of the voice style"
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

function TtsTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("tts");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addingVoice, setAddingVoice] = useState(false);
  const [voiceForm, setVoiceForm] = useState<VoiceFormState>(BLANK_VOICE);
  const [savingVoices, setSavingVoices] = useState(false);

  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;

  const getVoices = (): TtsVoice[] => {
    try {
      return entries["voices"]?.value
        ? (JSON.parse(entries["voices"].value) as TtsVoice[])
        : [];
    } catch {
      return [];
    }
  };
  const voices = getVoices();

  const maskId = (id: string) =>
    id.length < 8 ? "••••••" : `${id.slice(0, 4)}••••${id.slice(-4)}`;

  const saveVoices = async (next: TtsVoice[]) => {
    setSavingVoices(true);
    try {
      await updateEntry("voices", next);
      toast.success("Voices saved");
    } catch {
      toast.error("Failed to save voices");
    } finally {
      setSavingVoices(false);
    }
  };

  const handleDelete = (idx: number) =>
    saveVoices(voices.filter((_, i) => i !== idx));

  const handleAdd = async () => {
    if (!voiceForm.id || !voiceForm.name || !voiceForm.elevenLabsId) {
      toast.error("ID, name, and ElevenLabs ID are required");
      return;
    }
    await saveVoices([...voices, { ...voiceForm }]);
    setAddingVoice(false);
    setVoiceForm(BLANK_VOICE);
  };

  const handleEditSave = async (idx: number) => {
    await saveVoices(voices.map((v, i) => (i === idx ? { ...voiceForm } : v)));
    setEditingIdx(null);
  };

  const startEdit = (idx: number, voice: TtsVoice) => {
    setVoiceForm({ ...voice });
    setEditingIdx(idx);
    setAddingVoice(false);
  };

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section title="Pricing">
        <ConfigNumberField
          label="Cost per 1,000 Characters"
          description="Internal cost for TTS generation tracking and analytics"
          value={getNum("cost_per_1000_chars")}
          onSave={(v) => updateEntry("cost_per_1000_chars", v)}
          prefix="$"
        />
      </Section>

      <Section
        title="Voice Library"
        description="Manage available TTS voices. ElevenLabs IDs are partially masked."
      >
        <div className="space-y-3">
          {voices.length === 0 && (
            <p className="text-sm text-dim-3 text-center py-6">
              No voices configured yet.
            </p>
          )}
          {voices.map((voice, idx) => (
            <div
              key={`${voice.id}-${idx}`}
              className="rounded-lg border border-overlay-sm bg-overlay-xs"
            >
              {editingIdx === idx ? (
                <div className="p-4 space-y-3">
                  <VoiceFormFields form={voiceForm} onChange={setVoiceForm} />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingIdx(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEditSave(idx)}
                      disabled={savingVoices}
                    >
                      {savingVoices && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-studio-fg">
                        {voice.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          voice.gender === "female" &&
                            "bg-pink-500/10 text-pink-400 border-pink-500/20",
                          voice.gender === "male" &&
                            "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          voice.gender === "neutral" &&
                            "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        )}
                      >
                        {voice.gender}
                      </Badge>
                    </div>
                    {voice.description && (
                      <p className="text-xs text-dim-3 truncate mt-0.5">
                        {voice.description}
                      </p>
                    )}
                    <p className="text-xs text-dim-3 font-mono mt-0.5">
                      {maskId(voice.elevenLabsId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-dim-2 hover:text-studio-fg"
                      onClick={() => startEdit(idx, voice)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDelete(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingVoice ? (
            <div className="rounded-lg border border-studio-accent/30 bg-studio-accent/5 p-4 space-y-3">
              <p className="text-sm font-medium text-studio-fg">
                Add New Voice
              </p>
              <VoiceFormFields form={voiceForm} onChange={setVoiceForm} />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingVoice(false);
                    setVoiceForm(BLANK_VOICE);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={savingVoices}>
                  {savingVoices ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Add Voice
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed border-overlay-md text-dim-2 hover:text-studio-fg hover:border-overlay-lg"
              onClick={() => {
                setAddingVoice(true);
                setEditingIdx(null);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Voice
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── API Keys Tab ──────────────────────────────────────────────────────────────

const API_KEY_ROWS: { label: string; key: string }[] = [
  { label: "Anthropic", key: "anthropic_api_key" },
  { label: "OpenAI", key: "openai_api_key" },
  { label: "OpenRouter", key: "openrouter_api_key" },
  { label: "Fal.ai", key: "fal_api_key" },
  { label: "Runway", key: "runway_api_key" },
  { label: "ElevenLabs", key: "elevenlabs_api_key" },
  { label: "Resend (Email)", key: "resend_api_key" },
  { label: "Stripe Secret Key", key: "stripe_secret_key" },
  { label: "Stripe Webhook Secret", key: "stripe_webhook_secret" },
  { label: "Instagram API Token", key: "instagram_api_token" },
  { label: "Social API Key", key: "social_api_key" },
];

function ApiKeyField({
  label,
  isConfigured,
  onSave,
}: {
  label: string;
  isConfigured: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(value);
      setValue("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error(`Failed to save ${label}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-overlay-sm bg-overlay-xs px-4 py-3">
      <div className="w-44 shrink-0">
        <p className="text-sm font-medium text-studio-fg">{label}</p>
        {isConfigured ? (
          <Badge
            variant="outline"
            className="text-xs mt-1 bg-green-500/10 text-green-400 border-green-500/20"
          >
            Configured
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-xs mt-1 bg-overlay-sm text-dim-3 border-overlay-md"
          >
            Not set
          </Badge>
        )}
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              isConfigured ? "Enter new value to update" : "Enter key"
            }
            className="pr-9 text-sm font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim-3 hover:text-studio-fg transition-colors"
            onClick={() => setShow(!show)}
            tabIndex={-1}
          >
            {show ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          disabled={saving || !value.trim()}
          onClick={handleSave}
          className={cn(
            "shrink-0 min-w-[64px]",
            saved && "bg-green-500/20 text-green-400 border-green-500/30"
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("api_keys");

  const isConfigured = (key: string) => {
    const v = entries[key]?.value;
    return v != null && v !== "" && v !== "null";
  };

  if (isLoading) return <TabSkeleton />;

  const configuredCount = API_KEY_ROWS.filter((r) =>
    isConfigured(r.key)
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-300">
            Security Notice
          </p>
          <p className="text-sm text-amber-300/70 mt-1">
            API keys are encrypted at rest using AES-256-GCM. Existing values
            are never returned to the client. Leave any input blank to keep the
            existing value unchanged.
          </p>
        </div>
      </div>

      <Card className="border-overlay-sm bg-studio-surface">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-studio-fg">
            API Keys
          </CardTitle>
          <CardDescription className="text-sm text-dim-2">
            {configuredCount} of {API_KEY_ROWS.length} keys configured
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {API_KEY_ROWS.map((row) => (
            <ApiKeyField
              key={row.key}
              label={row.label}
              isConfigured={isConfigured(row.key)}
              onSave={(value) => updateEntry(row.key, value)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function SystemConfigPage() {
  const { t } = useTranslation();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleCacheInvalidate = async () => {
    setRefreshing(true);
    try {
      await authenticatedFetchJson("/api/admin/config/cache/invalidate", {
        method: "POST",
        body: JSON.stringify({ category: "all" }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["api", "admin", "system-config"],
      });
      toast.success("Config cache invalidated");
    } catch {
      toast.error("Failed to invalidate cache");
    } finally {
      setRefreshing(false);
    }
  };

  const TABS = [
    { value: "ai", label: t("admin_config_ai_tab") },
    { value: "video", label: t("admin_config_video_tab") },
    { value: "subscription", label: t("admin_config_subscription_tab") },
    { value: "feature_flags", label: t("admin_config_flags_tab") },
    { value: "content", label: t("admin_config_content_tab") },
    { value: "tts", label: t("admin_config_tts_tab") },
    { value: "api_keys", label: t("admin_config_api_keys_tab") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-studio-fg">
            {t("admin_system_config_title")}
          </h2>
          <p className="text-sm text-dim-2 mt-1">
            {t("admin_system_config_subtitle")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-dim-2 hover:text-studio-fg"
          onClick={handleCacheInvalidate}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Invalidate Cache
        </Button>
      </div>

      <Tabs defaultValue="ai">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-overlay-sm p-1 rounded-xl w-full justify-start">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-sm data-[state=active]:bg-studio-surface data-[state=active]:text-studio-fg data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="ai">
            <AiTab />
          </TabsContent>
          <TabsContent value="video">
            <VideoTab />
          </TabsContent>
          <TabsContent value="subscription">
            <SubscriptionTab />
          </TabsContent>
          <TabsContent value="feature_flags">
            <FeatureFlagsTab />
          </TabsContent>
          <TabsContent value="content">
            <ContentTab />
          </TabsContent>
          <TabsContent value="tts">
            <TtsTab />
          </TabsContent>
          <TabsContent value="api_keys">
            <ApiKeysTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
