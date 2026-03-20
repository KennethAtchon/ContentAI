import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  CreditCard,
  TrendingUp,
  Package,
  User,
  LayoutDashboard,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { SubscriptionManagement } from "@/features/account/components/subscription-management";
import { UsageDashboard } from "@/features/account/components/usage-dashboard";
import { ProfileEditor } from "@/features/account/components/profile-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { cn } from "@/shared/utils/helpers/utils";
import { toast } from "sonner";
import { useState } from "react";

function StudioOverview() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">
            {t("account_overview_title")}
          </CardTitle>
          <CardDescription>{t("account_overview_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">—</p>
              <p className="text-base text-muted-foreground mt-1">
                {t("account_overview_reels_analyzed")}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">—</p>
              <p className="text-base text-muted-foreground mt-1">
                {t("account_overview_content_generated")}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">—</p>
              <p className="text-base text-muted-foreground mt-1">
                {t("account_overview_queue_items")}
              </p>
            </div>
          </div>
          <div className="text-center">
            <Button asChild size="lg" className="px-8">
              <Link to="/studio/discover">
                {t("account_overview_open_studio")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type UserSettingsData = {
  preferredAiProvider?: string | null;
  preferredVideoProvider?: string | null;
  preferredVoiceId?: string | null;
  preferredTtsSpeed?: string | null;
  preferredAspectRatio?: string | null;
};

type Voice = {
  id: string;
  name: string;
  description: string;
  gender: string;
  previewUrl?: string;
};

function PreferenceSelect({
  label,
  value,
  onChange,
  options,
  saving,
  saved,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {saved && !saving && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
      </div>
      <Select value={value ?? "system_default"} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UserPreferences() {
  const { t } = useTranslation();
  const fetcher = useQueryFetcher();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } =
    useQuery<UserSettingsData>({
      queryKey: queryKeys.api.userSettings(),
      queryFn: () => fetcher("/api/customer/settings") as Promise<UserSettingsData>,
    });

  const { data: voices, isLoading: voicesLoading } = useQuery<Voice[]>({
    queryKey: [...queryKeys.api.userSettings(), "voices"],
    queryFn: () => fetcher("/api/audio/voices") as Promise<Voice[]>,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<UserSettingsData>) =>
      authenticatedFetchJson<UserSettingsData>("/api/customer/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.api.userSettings() });
    },
    onError: () => {
      toast.error(t("user_settings_save_error"));
    },
  });

  async function handleChange(field: keyof UserSettingsData, value: string) {
    setSavingField(field);
    setSavedField(null);
    const mapped = value === "system_default" ? null : value;
    try {
      await mutation.mutateAsync({ [field]: mapped });
      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
    } finally {
      setSavingField(null);
    }
  }

  const isLoading = settingsLoading || voicesLoading;

  const systemDefault = t("user_settings_system_default");

  const aiProviderOptions = [
    { value: "system_default", label: systemDefault },
    { value: "claude", label: "Claude (Anthropic)" },
    { value: "openai", label: "OpenAI GPT" },
    { value: "openrouter", label: "OpenRouter" },
  ];

  const videoProviderOptions = [
    { value: "system_default", label: systemDefault },
    { value: "kling-fal", label: "Kling (Fal)" },
    { value: "runway", label: "Runway ML" },
    { value: "image-ken-burns", label: "Image + Ken Burns" },
  ];

  const ttsSpeedOptions = [
    { value: "system_default", label: systemDefault },
    { value: "slow", label: t("user_settings_speed_slow") },
    { value: "normal", label: t("user_settings_speed_normal") },
    { value: "fast", label: t("user_settings_speed_fast") },
  ];

  const voiceOptions = [
    { value: "system_default", label: systemDefault },
    ...(voices ?? []).map((v) => ({
      value: v.id,
      label: `${v.name} — ${v.gender}`,
    })),
  ];

  const aspectRatios = [
    { value: "9:16", label: "9:16", desc: t("user_settings_aspect_portrait") },
    { value: "16:9", label: "16:9", desc: t("user_settings_aspect_landscape") },
    { value: "1:1", label: "1:1", desc: t("user_settings_aspect_square") },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">{t("user_settings_preferences")}</CardTitle>
          <CardDescription>{t("user_settings_preferences_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <PreferenceSelect
              label={t("user_settings_ai_provider")}
              value={settings?.preferredAiProvider ?? "system_default"}
              onChange={(v) => handleChange("preferredAiProvider", v)}
              options={aiProviderOptions}
              saving={savingField === "preferredAiProvider"}
              saved={savedField === "preferredAiProvider"}
            />
            <PreferenceSelect
              label={t("user_settings_video_provider")}
              value={settings?.preferredVideoProvider ?? "system_default"}
              onChange={(v) => handleChange("preferredVideoProvider", v)}
              options={videoProviderOptions}
              saving={savingField === "preferredVideoProvider"}
              saved={savedField === "preferredVideoProvider"}
            />
            <PreferenceSelect
              label={t("user_settings_voice")}
              value={settings?.preferredVoiceId ?? "system_default"}
              onChange={(v) => handleChange("preferredVoiceId", v)}
              options={voiceOptions}
              saving={savingField === "preferredVoiceId"}
              saved={savedField === "preferredVoiceId"}
            />
            <PreferenceSelect
              label={t("user_settings_tts_speed")}
              value={settings?.preferredTtsSpeed ?? "system_default"}
              onChange={(v) => handleChange("preferredTtsSpeed", v)}
              options={ttsSpeedOptions}
              saving={savingField === "preferredTtsSpeed"}
              saved={savedField === "preferredTtsSpeed"}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t("user_settings_aspect_ratio")}</Label>
              {savingField === "preferredAspectRatio" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {savedField === "preferredAspectRatio" && savingField !== "preferredAspectRatio" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              )}
            </div>
            <RadioGroup
              value={settings?.preferredAspectRatio ?? "system_default"}
              onValueChange={(v) => handleChange("preferredAspectRatio", v)}
              className="flex flex-wrap gap-3"
            >
              <div
                className={cn(
                  "flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                  (settings?.preferredAspectRatio == null)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50",
                )}
              >
                <RadioGroupItem value="system_default" id="ar-default" />
                <Label htmlFor="ar-default" className="cursor-pointer font-normal">
                  {systemDefault}
                </Label>
              </div>
              {aspectRatios.map((ar) => (
                <div
                  key={ar.value}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                    settings?.preferredAspectRatio === ar.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50",
                  )}
                >
                  <RadioGroupItem value={ar.value} id={`ar-${ar.value}`} />
                  <Label htmlFor={`ar-${ar.value}`} className="cursor-pointer font-normal">
                    <span className="font-semibold">{ar.label}</span>
                    <span className="ml-1.5 text-muted-foreground text-xs">{ar.desc}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccountInteractive() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/50">
        <TabsTrigger
          value="overview"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">{t("account_tabs_overview")}</span>
          <span className="sm:hidden">{t("account_tabs_overview_short")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="subscription"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <CreditCard className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t("account_tabs_subscription")}
          </span>
          <span className="sm:hidden">
            {t("account_tabs_subscription_short")}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="usage"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <TrendingUp className="h-4 w-4" />
          {t("account_tabs_usage")}
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <Package className="h-4 w-4" />
          {t("metadata_admin_orders_title")}
        </TabsTrigger>
        <TabsTrigger
          value="preferences"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{t("account_tabs_preferences")}</span>
          <span className="sm:hidden">{t("account_tabs_preferences_short")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="profile"
          className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <User className="h-4 w-4" />
          {t("account_tabs_profile")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-6">
        <StudioOverview />
      </TabsContent>

      <TabsContent value="subscription" className="space-y-6 mt-6">
        <SubscriptionManagement />
      </TabsContent>

      <TabsContent value="usage" className="space-y-6 mt-6">
        <UsageDashboard />
      </TabsContent>

      <TabsContent value="orders" className="space-y-6 mt-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">
              {t("account_orders_history")}
            </CardTitle>
            <CardDescription>
              {t("common_view_your_past_orders_and_subscriptions")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-medium text-foreground mb-2">
                {t("account_orders_no_orders")}
              </p>
              <p className="text-muted-foreground">
                {t(
                  "common_your_order_history_will_appear_here_once_you_make_a_purchase"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="preferences" className="space-y-6 mt-6">
        <UserPreferences />
      </TabsContent>

      <TabsContent value="profile" className="space-y-6 mt-6">
        <ProfileEditor />
      </TabsContent>
    </Tabs>
  );
}
