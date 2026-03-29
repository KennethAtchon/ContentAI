import { useTranslation } from "react-i18next";
import { Loader2, Captions } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { Clip } from "../../types/editor";
import {
  InspectorSection,
  InspectorPropRow,
  InspectorValuePill,
} from "./InspectorPrimitives";

interface AutoCaptionUi {
  isError: boolean;
  isPending: boolean;
}

interface Props {
  clip: Clip;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  isGenerableClip: boolean;
  autoCaption: AutoCaptionUi;
  onGenerateCaptions: () => void | Promise<void>;
}

export function InspectorClipMetaPanel({
  clip,
  onUpdateClip,
  isGenerableClip,
  autoCaption,
  onGenerateCaptions,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <InspectorSection title={t("inspector_section_clip")}>
        <InspectorPropRow label={t("inspector_prop_name")}>
          <InspectorValuePill value={clip.label} />
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_start")}>
          <InspectorValuePill value={`${(clip.startMs / 1000).toFixed(2)}s`} />
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_duration")}>
          <InspectorValuePill value={`${(clip.durationMs / 1000).toFixed(2)}s`} />
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_speed")}>
          <Select
            value={String(clip.speed)}
            onValueChange={(v) => onUpdateClip(clip.id, { speed: Number(v) })}
          >
            <SelectTrigger className="h-6 w-20 text-xs px-2 py-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">
                  {s}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_enabled")}>
          <Switch
            checked={clip.enabled !== false}
            onCheckedChange={(checked) => onUpdateClip(clip.id, { enabled: checked })}
          />
        </InspectorPropRow>
      </InspectorSection>

      {isGenerableClip && (
        <InspectorSection title={t("editor_captions_generate_section")}>
          {autoCaption.isError && (
            <p className="text-[11px] text-red-400 mb-2">{t("editor_captions_failed")}</p>
          )}
          <button
            type="button"
            onClick={() => void onGenerateCaptions()}
            disabled={autoCaption.isPending}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-studio-accent/10 text-studio-accent text-xs font-semibold border border-studio-accent/30 cursor-pointer hover:bg-studio-accent/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoCaption.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t("editor_captions_generating")}
              </>
            ) : (
              <>
                <Captions size={12} />
                {t("editor_captions_generate_for_clip")}
              </>
            )}
          </button>
        </InspectorSection>
      )}
    </>
  );
}
