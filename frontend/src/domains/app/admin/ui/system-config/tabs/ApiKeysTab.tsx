import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldAlert, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { invalidateAdminApiKeysStatus } from "@/app/query/query-invalidation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import { Badge } from "@/shared/ui/primitives/badge";
import { cn } from "@/shared/lib/utils";
import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { TabSkeleton } from "../components/TabSkeleton";
import type { ApiKeysStatusResponse } from "../types";

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
  source,
  onSave,
}: {
  label: string;
  isConfigured: boolean;
  source?: "db" | "env" | "none";
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
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              variant="outline"
              className="text-xs bg-green-500/10 text-green-400 border-green-500/20"
            >
              Configured
            </Badge>
            {source === "env" && (
              <Badge
                variant="outline"
                className="text-xs bg-overlay-xs text-dim-3 border-overlay-sm"
              >
                via env
              </Badge>
            )}
          </div>
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

export function ApiKeysTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("api_keys");
  const fetcher = useQueryFetcher<ApiKeysStatusResponse>();
  const queryClient = useQueryClient();
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: queryKeys.api.admin.apiKeysStatus(),
    queryFn: () => fetcher("/api/admin/config/api-keys/status"),
    staleTime: 30_000,
  });

  const isConfigured = (key: string): boolean => {
    if (statusData) return statusData.keys[key]?.active ?? false;
    const v = entries[key]?.value;
    return v != null && v !== "" && v !== "null";
  };

  const getSource = (key: string): "db" | "env" | "none" | undefined =>
    statusData?.keys[key]?.source;

  if (isLoading || statusLoading) return <TabSkeleton />;

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
              source={getSource(row.key)}
              onSave={async (value) => {
                await updateEntry(row.key, value);
                await invalidateAdminApiKeysStatus(queryClient);
              }}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
