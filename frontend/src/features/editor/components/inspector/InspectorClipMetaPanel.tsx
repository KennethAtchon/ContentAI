import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
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

interface Props {
  clip: Clip;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  captionAction?: {
    label: string;
    helperText: string;
    status: string;
    disabled?: boolean;
    onClick: () => void;
  };
}

export function InspectorClipMetaPanel({
  clip,
  onUpdateClip,
  captionAction,
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
      {captionAction && (
        <InspectorSection title={t("inspector_section_captions")}>
          <div className="space-y-2">
            <p className="text-[11px] leading-4 text-dim-3">
              {captionAction.helperText}
            </p>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={captionAction.disabled}
                onClick={captionAction.onClick}
                className="h-7 px-2.5 text-xs"
              >
                {captionAction.label}
              </Button>
              <InspectorValuePill value={captionAction.status} />
            </div>
          </div>
        </InspectorSection>
      )}
    </>
  );
}
