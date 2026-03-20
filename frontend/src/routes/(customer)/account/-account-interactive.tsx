import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Package,
  User,
  SlidersHorizontal,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  LogOut,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/shared/contexts/app-context";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import { cn } from "@/shared/utils/helpers/utils";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { SubscriptionManagement } from "@/features/account/components/subscription-management";
import { UsageDashboard } from "@/features/account/components/usage-dashboard";
import { ProfileEditor } from "@/features/account/components/profile-editor";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section =
  | "overview"
  | "subscription"
  | "usage"
  | "orders"
  | "preferences"
  | "profile";

interface SidebarUsage {
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number | null;
  contentGenerated: number;
  contentGeneratedLimit: number | null;
  queueSize: number;
  queueLimit: number | null;
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

// ─── Tier display helpers ────────────────────────────────────────────────────

function getTierDisplay(role: string | null | undefined) {
  switch (role) {
    case "basic":
      return {
        label: "Creator",
        badgeClass:
          "text-[hsl(234_89%_80%)] bg-[hsl(234_89%_74%/0.1)] border border-[hsl(234_89%_74%/0.2)]",
        dotClass: "bg-[hsl(234_89%_74%)]",
      };
    case "pro":
      return {
        label: "Pro",
        badgeClass:
          "text-[hsl(270_91%_82%)] bg-[hsl(270_91%_75%/0.1)] border border-[hsl(270_91%_75%/0.2)]",
        dotClass: "bg-[hsl(270_91%_75%)]",
      };
    case "agency":
      return {
        label: "Agency",
        badgeClass:
          "text-amber-300 bg-amber-500/10 border border-amber-500/20",
        dotClass: "bg-amber-400",
      };
    default:
      return {
        label: "Free",
        badgeClass:
          "text-dim-2 bg-overlay-xs border border-border",
        dotClass: "bg-foreground/25",
      };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** -1 and null both mean unlimited */
function isUnlimited(limit: number | null | undefined): boolean {
  return limit === null || limit === -1;
}

// ─── Usage bar ───────────────────────────────────────────────────────────────

function UsageBar({
  value,
  max,
}: {
  value: number;
  max: number | null;
}) {
  const effectiveMax = isUnlimited(max) ? null : max;
  const pct = effectiveMax ? Math.min(100, Math.round((value / effectiveMax) * 100)) : 0;
  const isHigh = pct >= 80;
  return (
    <div className="h-[3px] w-full rounded-full bg-overlay-sm overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          isHigh
            ? "bg-red-400/70"
            : "bg-[hsl(234_89%_74%/0.6)]",
        )}
        style={{ width: effectiveMax ? `${pct}%` : "0%" }}
      />
    </div>
  );
}

// ─── Sidebar panel ───────────────────────────────────────────────────────────

function SidebarPanel({
  activeSection,
  onNavigate,
}: {
  activeSection: Section;
  onNavigate: (s: Section) => void;
}) {
  const { t } = useTranslation();
  const { user, profile, logout, isAdmin } = useApp();
  const navigate = useNavigate();
  const { role } = useSubscription();
  const fetcher = useQueryFetcher<SidebarUsage>();

  const { data: usage } = useQuery<SidebarUsage>({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => fetcher("/api/customer/usage"),
    enabled: !!user,
  });

  const name = profile?.name || user?.displayName || "—";
  const email = profile?.email || user?.email || "—";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const tier = getTierDisplay(role);

  const navItems: { id: Section; icon: React.FC<{ className?: string }>; label: string }[] = [
    { id: "overview", icon: LayoutDashboard, label: t("account_tabs_overview") },
    { id: "subscription", icon: CreditCard, label: t("account_tabs_subscription") },
    { id: "usage", icon: TrendingUp, label: t("account_tabs_usage") },
    { id: "orders", icon: Package, label: t("metadata_admin_orders_title") },
    { id: "preferences", icon: SlidersHorizontal, label: t("account_tabs_preferences") },
    { id: "profile", icon: User, label: t("account_tabs_profile") },
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border">
      <div className="flex flex-col gap-6 p-5 h-full">

        {/* Identity */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[hsl(234_89%_74%/0.08)] border border-[hsl(234_89%_74%/0.15)] flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[hsl(234_89%_74%)]">
                {initials}
              </span>
            </div>
            <div className="min-w-0 pt-0.5 flex-1">
              <p className="font-semibold text-sm leading-tight truncate text-foreground">
                {name}
              </p>
              <p className="text-[11px] text-dim-2 truncate mt-0.5">
                {email}
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium",
              tier.badgeClass,
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", tier.dotClass)} />
            {tier.label} Plan
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Usage compact */}
        {usage && (
          <>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
                {t("account_tabs_usage")}
              </p>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-dim-2">
                    {t("account_overview_reels_analyzed")}
                  </span>
                  <span className="text-[11px] text-dim-1 tabular-nums">
                    {usage.reelsAnalyzed}
                    <span className="text-dim-3">
                      /{isUnlimited(usage.reelsAnalyzedLimit) ? "∞" : usage.reelsAnalyzedLimit}
                    </span>
                  </span>
                </div>
                {!isUnlimited(usage.reelsAnalyzedLimit) && (
                  <UsageBar value={usage.reelsAnalyzed} max={usage.reelsAnalyzedLimit} />
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-dim-2">
                    {t("account_overview_content_generated")}
                  </span>
                  <span className="text-[11px] text-dim-1 tabular-nums">
                    {usage.contentGenerated}
                    <span className="text-dim-3">
                      /{isUnlimited(usage.contentGeneratedLimit) ? "∞" : usage.contentGeneratedLimit}
                    </span>
                  </span>
                </div>
                {!isUnlimited(usage.contentGeneratedLimit) && (
                  <UsageBar value={usage.contentGenerated} max={usage.contentGeneratedLimit} />
                )}
              </div>
            </div>

            <div className="h-px bg-border" />
          </>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5">
          {navItems.map(({ id, icon: Icon, label }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  active
                    ? "bg-overlay-sm text-foreground"
                    : "text-dim-2 hover:text-dim-1 hover:bg-overlay-xs",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-[hsl(234_89%_74%)]" : "",
                  )}
                />
                <span className={cn("font-medium", active ? "text-foreground" : "")}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="h-px bg-border" />

        {/* Bottom actions */}
        <div className="space-y-0.5">
          <Link
            to="/studio/discover"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-2 hover:text-dim-1 hover:bg-overlay-xs transition-colors group"
          >
            <ArrowUpRight className="h-4 w-4 shrink-0 group-hover:text-[hsl(234_89%_74%)] transition-colors" />
            <span>{t("navigation_discover")}</span>
          </Link>
          {isAdmin && (
            <button
              onClick={() => navigate({ to: "/admin/dashboard" })}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-2 hover:text-dim-1 hover:bg-overlay-xs transition-colors text-left"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>{t("navigation_admin")}</span>
            </button>
          )}
          <button
            onClick={() => logout().then(() => navigate({ to: "/" }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim-3 hover:text-red-400/80 hover:bg-red-500/[0.06] transition-colors text-left"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t("common_sign_out")}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Mobile nav ───────────────────────────────────────────────────────────────

function MobileNav({
  activeSection,
  onNavigate,
}: {
  activeSection: Section;
  onNavigate: (s: Section) => void;
}) {
  const { t } = useTranslation();
  const { user, profile } = useApp();
  const { role } = useSubscription();

  const name = profile?.name || user?.displayName || "—";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const tier = getTierDisplay(role);

  const navItems: { id: Section; icon: React.FC<{ className?: string }>; label: string }[] = [
    { id: "overview", icon: LayoutDashboard, label: t("account_tabs_overview_short") },
    { id: "subscription", icon: CreditCard, label: t("account_tabs_subscription_short") },
    { id: "usage", icon: TrendingUp, label: t("account_tabs_usage") },
    { id: "orders", icon: Package, label: "Orders" },
    { id: "preferences", icon: SlidersHorizontal, label: t("account_tabs_preferences_short") },
    { id: "profile", icon: User, label: t("account_tabs_profile") },
  ];

  return (
    <div className="md:hidden border-b border-border px-4 pt-4 pb-0">
      {/* Mobile identity strip */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[hsl(234_89%_74%/0.08)] border border-[hsl(234_89%_74%/0.15)] flex items-center justify-center">
          <span className="text-xs font-bold text-[hsl(234_89%_74%)]">{initials}</span>
        </div>
        <p className="text-sm font-semibold truncate">{name}</p>
        <div
          className={cn(
            "ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
            tier.badgeClass,
          )}
        >
          <div className={cn("w-1 h-1 rounded-full", tier.dotClass)} />
          {tier.label}
        </div>
      </div>

      {/* Scrolling tab row */}
      <div className="flex overflow-x-auto gap-1 pb-3 scrollbar-none">
        {navItems.map(({ id, icon: Icon, label }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors font-medium",
                active
                  ? "bg-overlay-sm text-foreground"
                  : "text-dim-2 hover:text-dim-1",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active ? "text-[hsl(234_89%_74%)]" : "")} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overview section ────────────────────────────────────────────────────────

function StudioOverview({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { t } = useTranslation();
  const { user, profile } = useApp();
  const fetcher = useQueryFetcher<SidebarUsage>();

  const { data: usage, isLoading } = useQuery<SidebarUsage>({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => fetcher("/api/customer/usage"),
    enabled: !!user,
  });

  const name = profile?.name || user?.displayName || "";
  const firstName = name.split(" ")[0] || "there";

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {firstName}.
        </h2>
        <p className="text-sm text-dim-2 mt-1">
          {t("account_overview_subtitle")}
        </p>
      </div>

      {/* Stats row */}
      {isLoading ? (
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 flex-1 rounded-lg bg-overlay-xs animate-pulse" />
          ))}
        </div>
      ) : usage ? (
        <div className="flex gap-px border border-border rounded-xl overflow-hidden">
          {[
            {
              value: usage.reelsAnalyzed,
              limit: usage.reelsAnalyzedLimit,
              label: t("account_overview_reels_analyzed"),
            },
            {
              value: usage.contentGenerated,
              limit: usage.contentGeneratedLimit,
              label: t("account_overview_content_generated"),
            },
            {
              value: usage.queueSize,
              limit: usage.queueLimit,
              label: t("account_overview_queue_items"),
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex-1 bg-overlay-xs px-5 py-4 space-y-0.5"
            >
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {stat.value}
                <span className="text-base font-normal text-dim-3">
                  /{isUnlimited(stat.limit) ? "∞" : stat.limit}
                </span>
              </p>
              <p className="text-[11px] text-dim-2 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="default" className="gap-2">
          <Link to="/studio/discover">
            {t("account_overview_open_studio")}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={() => onNavigate("subscription")}
          className="text-dim-1 border-border hover:border-overlay-md"
        >
          {t("account_tabs_subscription")}
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={() => onNavigate("usage")}
          className="text-dim-2 hover:text-dim-1"
        >
          {t("account_tabs_usage")}
        </Button>
      </div>

      {/* Quick nav grid */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(
            [
              { id: "subscription" as Section, icon: CreditCard, label: t("account_tabs_subscription"), desc: "Manage your plan" },
              { id: "preferences" as Section, icon: SlidersHorizontal, label: t("account_tabs_preferences"), desc: "AI & video settings" },
              { id: "profile" as Section, icon: User, label: t("account_tabs_profile"), desc: "Name, email, contact" },
            ] as const
          ).map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="group flex items-start gap-3 p-3.5 rounded-xl border border-border bg-overlay-xs hover:bg-border hover:border-border transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-dim-3 group-hover:text-[hsl(234_89%_74%)] transition-colors mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-dim-1 group-hover:text-foreground transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-dim-3 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Orders section ───────────────────────────────────────────────────────────

function OrdersSection() {
  const { t } = useTranslation();
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
      <Package className="h-9 w-9 text-dim-3" />
      <p className="font-medium text-dim-1">{t("account_orders_no_orders")}</p>
      <p className="text-sm text-dim-3 max-w-xs">
        {t("common_your_order_history_will_appear_here_once_you_make_a_purchase")}
      </p>
    </div>
  );
}

// ─── Preferences section ──────────────────────────────────────────────────────

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
        <Label className="text-sm font-medium text-dim-1">{label}</Label>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-dim-3" />}
        {saved && !saving && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
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
      queryFn: () =>
        fetcher("/api/customer/settings") as Promise<UserSettingsData>,
    });

  const { data: voices, isLoading: voicesLoading } = useQuery<Voice[]>({
    queryKey: [...queryKeys.api.userSettings(), "voices"],
    queryFn: () =>
      (
        fetcher("/api/audio/voices") as Promise<{ voices: Voice[] }>
      ).then((r) => r.voices),
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
    {
      value: "9:16",
      label: "9:16",
      desc: t("user_settings_aspect_portrait"),
    },
    {
      value: "16:9",
      label: "16:9",
      desc: t("user_settings_aspect_landscape"),
    },
    { value: "1:1", label: "1:1", desc: t("user_settings_aspect_square") },
  ];

  if (settingsLoading || voicesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-dim-3" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("user_settings_preferences")}
        </h2>
        <p className="text-sm text-dim-2 mt-1">
          {t("user_settings_preferences_subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
          AI & Generation
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-6">
        <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
          Voice & Audio
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
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
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold mb-1">
              Output Format
            </p>
            <Label className="text-sm font-medium text-dim-1">
              {t("user_settings_aspect_ratio")}
            </Label>
          </div>
          {savingField === "preferredAspectRatio" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-dim-3" />
          )}
          {savedField === "preferredAspectRatio" &&
            savingField !== "preferredAspectRatio" && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            )}
        </div>
        <RadioGroup
          value={settings?.preferredAspectRatio ?? "system_default"}
          onValueChange={(v) => handleChange("preferredAspectRatio", v)}
          className="flex flex-wrap gap-2"
        >
          {[
            { value: "system_default", label: systemDefault, desc: "" },
            ...aspectRatios,
          ].map((ar) => {
            const active =
              ar.value === "system_default"
                ? settings?.preferredAspectRatio == null
                : settings?.preferredAspectRatio === ar.value;
            return (
              <label
                key={ar.value}
                htmlFor={`ar-${ar.value}`}
                className={cn(
                  "flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-2.5 transition-colors",
                  active
                    ? "border-[hsl(234_89%_74%/0.4)] bg-[hsl(234_89%_74%/0.06)]"
                    : "border-border hover:border-overlay-md bg-overlay-xs",
                )}
              >
                <RadioGroupItem
                  value={ar.value}
                  id={`ar-${ar.value}`}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-dim-1">
                  {ar.label}
                </span>
                {ar.desc && (
                  <span className="text-xs text-dim-3">{ar.desc}</span>
                )}
              </label>
            );
          })}
        </RadioGroup>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

const SECTION_META: Record<Section, { title: string; desc: string }> = {
  overview: { title: "Overview", desc: "" },
  subscription: { title: "Subscription", desc: "Your current plan and billing" },
  usage: { title: "Usage", desc: "Generation history and limits" },
  orders: { title: "Orders", desc: "Purchase history" },
  preferences: { title: "Preferences", desc: "Customize your AI defaults" },
  profile: { title: "Profile", desc: "Account information" },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function AccountInteractive() {
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const meta = SECTION_META[activeSection];

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <SidebarPanel activeSection={activeSection} onNavigate={setActiveSection} />

      {/* Right panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Mobile nav */}
        <MobileNav activeSection={activeSection} onNavigate={setActiveSection} />

        {/* Section header (desktop only, overview skips it) */}
        {activeSection !== "overview" && (
          <div className="hidden md:block px-8 pt-7 pb-0">
            <h2 className="text-base font-semibold text-foreground">{meta.title}</h2>
            {meta.desc && (
              <p className="text-xs text-dim-2 mt-0.5">{meta.desc}</p>
            )}
            <div className="mt-5 h-px bg-border" />
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex-1 p-5 md:px-8 md:py-7"
          >
            {activeSection === "overview" && (
              <StudioOverview onNavigate={setActiveSection} />
            )}
            {activeSection === "subscription" && <SubscriptionManagement />}
            {activeSection === "usage" && <UsageDashboard />}
            {activeSection === "orders" && <OrdersSection />}
            {activeSection === "preferences" && <UserPreferences />}
            {activeSection === "profile" && <ProfileEditor />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
