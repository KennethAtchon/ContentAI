import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/primitives/radio-group";
import { useUserPreferences } from "../hooks/use-user-preferences";

// ─── PreferenceSelect ─────────────────────────────────────────────────────────

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
        {saved && !saving && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        )}
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

// ─── UserPreferences ──────────────────────────────────────────────────────────

export function UserPreferences() {
  const { t } = useTranslation();
  const {
    aiDefaults,
    handleChange,
    savedField,
    savingField,
    settings,
    settingsLoading,
    videoDefaults,
    voices,
    voicesLoading,
  } = useUserPreferences();

  const systemDefault = t("user_settings_system_default");

  const systemDefaultLabel = aiDefaults?.defaultProviderLabel
    ? `${systemDefault} — ${aiDefaults.defaultProviderLabel}`
    : systemDefault;

  const aiProviderOptions = [
    { value: "system_default", label: systemDefaultLabel },
    { value: "claude", label: "Claude (Anthropic)" },
    { value: "openai", label: "OpenAI GPT" },
    { value: "openrouter", label: "OpenRouter" },
  ];

  const videoSystemDefaultLabel = videoDefaults?.defaultProviderLabel
    ? `${systemDefault} — ${videoDefaults.defaultProviderLabel}`
    : systemDefault;

  const videoProviderOptions = [
    { value: "system_default", label: videoSystemDefaultLabel },
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
          <div className="space-y-1.5">
            <PreferenceSelect
              label={t("user_settings_ai_provider")}
              value={settings?.preferredAiProvider ?? "system_default"}
              onChange={(v) => handleChange("preferredAiProvider", v)}
              options={aiProviderOptions}
              saving={savingField === "preferredAiProvider"}
              saved={savedField === "preferredAiProvider"}
            />
            {aiDefaults?.defaultProvider &&
              (!settings?.preferredAiProvider ||
                settings.preferredAiProvider === "system_default") && (
                <p className="text-[11px] text-dim-3 leading-relaxed">
                  Currently using{" "}
                  <span className="text-dim-2 font-medium">
                    {aiDefaults.defaultProviderLabel}
                  </span>
                  {aiDefaults.generationModel && (
                    <>
                      {" "}
                      <span className="font-mono text-dim-3">
                        ({aiDefaults.generationModel})
                      </span>
                    </>
                  )}
                </p>
              )}
          </div>
          <div className="space-y-1.5">
            <PreferenceSelect
              label={t("user_settings_video_provider")}
              value={settings?.preferredVideoProvider ?? "system_default"}
              onChange={(v) => handleChange("preferredVideoProvider", v)}
              options={videoProviderOptions}
              saving={savingField === "preferredVideoProvider"}
              saved={savedField === "preferredVideoProvider"}
            />
            {videoDefaults?.defaultProvider &&
              (!settings?.preferredVideoProvider ||
                settings.preferredVideoProvider === "system_default") && (
                <p className="text-[11px] text-dim-3 leading-relaxed">
                  Currently using{" "}
                  <span className="text-dim-2 font-medium">
                    {videoDefaults.defaultProviderLabel}
                  </span>
                </p>
              )}
          </div>
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
                    : "border-border hover:border-overlay-md bg-overlay-xs"
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
