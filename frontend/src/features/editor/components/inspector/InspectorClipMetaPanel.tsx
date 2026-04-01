import { useTranslation } from "react-i18next";
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
}

export function InspectorClipMetaPanel({
  clip,
  onUpdateClip,
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
    </>
  );
}
