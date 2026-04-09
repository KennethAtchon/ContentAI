import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { Switch } from "@/shared/components/ui/switch";
import type { ClipPatch, Clip } from "../../types/editor";
import { isTextClip } from "../../utils/clip-types";
import {
  InspectorSection,
  InspectorPropRow,
  InspectorSliderRow,
} from "./InspectorPrimitives";

interface Props {
  clip: Clip;
  isTextTrack: boolean;
  onUpdateClip: (clipId: string, patch: ClipPatch) => void;
}

export function InspectorTextAndCaptionPanels({
  clip,
  isTextTrack,
  onUpdateClip,
}: Props) {
  const { t } = useTranslation();
  if (!isTextClip(clip)) return null;

  return (
    <>
      {isTextTrack && (
        <InspectorSection title={t("inspector_section_text")}>
          <textarea
            className="w-full text-xs bg-overlay-sm text-dim-1 px-2 py-1.5 rounded border border-overlay-md resize-none"
            rows={3}
            value={clip.textContent}
            onChange={(e) =>
              onUpdateClip(clip.id, { textContent: e.target.value })
            }
          />
        </InspectorSection>
      )}

      <InspectorSection title={t("inspector_section_text_style")}>
        <InspectorPropRow label={t("editor_text_smart_chunks")}>
          <Switch
            checked={clip.textAutoChunk === true}
            onCheckedChange={(checked) =>
              onUpdateClip(clip.id, { textAutoChunk: checked })
            }
          />
        </InspectorPropRow>
        <p className="text-[10px] text-dim-3 -mt-1 mb-2">
          {t("editor_text_smart_chunks_hint")}
        </p>
        <InspectorSliderRow
          label={t("inspector_prop_text_font_size")}
          value={clip.textStyle?.fontSize ?? 32}
          min={12}
          max={120}
          step={2}
          onChange={(v) =>
            onUpdateClip(clip.id, {
              textStyle: {
                ...clip.textStyle,
                fontSize: v,
                fontWeight: clip.textStyle?.fontWeight ?? "normal",
                color: clip.textStyle?.color ?? "#ffffff",
                align: clip.textStyle?.align ?? "center",
              },
            })
          }
        />
        <InspectorPropRow label={t("inspector_prop_font_weight")}>
          <button
            type="button"
            onClick={() =>
              onUpdateClip(clip.id, {
                textStyle: {
                  fontSize: clip.textStyle?.fontSize ?? 32,
                  fontWeight:
                    clip.textStyle?.fontWeight === "bold" ? "normal" : "bold",
                  color: clip.textStyle?.color ?? "#ffffff",
                  align: clip.textStyle?.align ?? "center",
                },
              })
            }
            className={cn(
              "text-xs px-2 py-0.5 rounded border cursor-pointer transition-colors",
              clip.textStyle?.fontWeight === "bold"
                ? "bg-studio-accent/20 border-studio-accent text-studio-accent"
                : "bg-overlay-sm border-overlay-md text-dim-2"
            )}
          >
            {t("inspector_text_weight_bold")}
          </button>
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_text_color")}>
          <input
            type="color"
            value={clip.textStyle?.color ?? "#ffffff"}
            onChange={(e) =>
              onUpdateClip(clip.id, {
                textStyle: {
                  fontSize: clip.textStyle?.fontSize ?? 32,
                  fontWeight: clip.textStyle?.fontWeight ?? "normal",
                  color: e.target.value,
                  align: clip.textStyle?.align ?? "center",
                },
              })
            }
            className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
          />
        </InspectorPropRow>
        <InspectorPropRow label={t("inspector_prop_text_align")}>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() =>
                  onUpdateClip(clip.id, {
                    textStyle: {
                      fontSize: clip.textStyle?.fontSize ?? 32,
                      fontWeight: clip.textStyle?.fontWeight ?? "normal",
                      color: clip.textStyle?.color ?? "#ffffff",
                      align: a,
                    },
                  })
                }
                className={cn(
                  "text-xs px-2 py-0.5 rounded border cursor-pointer transition-colors capitalize",
                  (clip.textStyle?.align ?? "center") === a
                    ? "bg-studio-accent/20 border-studio-accent text-studio-accent"
                    : "bg-overlay-sm border-overlay-md text-dim-2"
                )}
              >
                {a[0].toUpperCase()}
              </button>
            ))}
          </div>
        </InspectorPropRow>
      </InspectorSection>
    </>
  );
}
