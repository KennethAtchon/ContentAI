import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Trash2 } from "lucide-react";
import type { ClipPatch, Transition } from "../../types/editor";
import { useEditorContext } from "../../context/EditorContext";
import {
  isCaptionClip,
  isMediaClip as isMediaTimelineClip,
  isTextClip,
} from "../../utils/clip-types";
import { useCaptionPresets } from "../../caption/hooks/useCaptionPresets";
import { useCaptionDoc } from "../../caption/hooks/useCaptionDoc";
import { useUpdateCaptionDoc } from "../../caption/hooks/useUpdateCaptionDoc";
import { useTranscription } from "../../caption/hooks/useTranscription";
import { CaptionPresetPicker } from "../../caption/components/CaptionPresetPicker";
import { CaptionStylePanel } from "../../caption/components/CaptionStylePanel";
import { CaptionTranscriptEditor } from "../../caption/components/CaptionTranscriptEditor";
import { CaptionLanguageScopeNotice } from "../../caption/components/CaptionLanguageScopeNotice";
import { INSPECTOR_EFFECT_DEFINITIONS, INSPECTOR_TRANSITION_OPTIONS } from "../../constants/inspector-ui-constants";
import { InspectorSection } from "./InspectorSection";
import { InspectorPropRow, InspectorSliderRow, InspectorValuePill } from "./InspectorPropRow";

interface AdjustTabProps {
  selectedTransition: Transition | null;
  onEffectPreview?: (patch: ClipPatch | null) => void;
}

export function AdjustTab({ selectedTransition, onEffectPreview }: AdjustTabProps) {
  const { t } = useTranslation();
  const {
    state,
    selectedClip,
    selectedTrack,
    updateClip: onUpdateClip,
    setTransition: onSetTransition,
    removeTransition: onRemoveTransition,
    updateCaptionStyle,
    addCaptionClip,
    selectClip,
  } = useEditorContext();

  const tracks = state.tracks;
  const isTextTrack = selectedTrack?.type === "text";
  const isMediaTrack = !isTextTrack;

  const actualSelectedMediaClip =
    selectedClip && isMediaTimelineClip(selectedClip) ? selectedClip : null;

  const selectedCaptionClip =
    selectedClip && isCaptionClip(selectedClip) ? selectedClip : null;

  const selectedAudioClip =
    actualSelectedMediaClip && selectedTrack?.type === "audio"
      ? actualSelectedMediaClip
      : null;

  const { data: captionPresets = [] } = useCaptionPresets();
  const { data: captionDoc } = useCaptionDoc(selectedCaptionClip?.captionDocId ?? null);
  const updateCaptionDocMutation = useUpdateCaptionDoc();
  const transcriptionMutation = useTranscription();

  const [captionSyncStatus, setCaptionSyncStatus] = useState<
    Record<string, "idle" | "transcribing" | "ready" | "failed" | "stale">
  >({});
  const [captionSyncErrors, setCaptionSyncErrors] = useState<Record<string, string>>({});

  const textTrackId = tracks.find((tr) => tr.type === "text")?.id ?? null;
  const defaultCaptionPresetId = captionPresets[0]?.id ?? null;

  const linkedCaptionClip = useMemo(
    () =>
      selectedAudioClip
        ? (tracks
            .flatMap((tr) => tr.clips)
            .filter(isCaptionClip)
            .find((c) => c.originVoiceoverClipId === selectedAudioClip.id) ?? null)
        : null,
    [tracks, selectedAudioClip]
  );

  const captionClipIsStale =
    !!selectedAudioClip &&
    !!linkedCaptionClip &&
    (linkedCaptionClip.startMs !== selectedAudioClip.startMs ||
      linkedCaptionClip.durationMs !== selectedAudioClip.durationMs ||
      linkedCaptionClip.sourceStartMs !== selectedAudioClip.trimStartMs ||
      linkedCaptionClip.sourceEndMs !==
        selectedAudioClip.trimStartMs +
          Math.round(selectedAudioClip.durationMs * (selectedAudioClip.speed || 1)) ||
      !selectedAudioClip.assetId);

  const captionActionStatus = selectedAudioClip
    ? (captionSyncStatus[selectedAudioClip.id] ??
        (captionClipIsStale ? "stale" : linkedCaptionClip ? "ready" : "idle"))
    : "idle";
  const captionActionError = selectedAudioClip ? (captionSyncErrors[selectedAudioClip.id] ?? "") : "";

  const handleCaptionSync = async () => {
    if (!selectedAudioClip?.assetId || !textTrackId || !defaultCaptionPresetId) return;
    setCaptionSyncStatus((prev) => ({ ...prev, [selectedAudioClip.id]: "transcribing" }));
    setCaptionSyncErrors((prev) => {
      const next = { ...prev };
      delete next[selectedAudioClip.id];
      return next;
    });
    try {
      const result = await transcriptionMutation.mutateAsync({
        assetId: selectedAudioClip.assetId,
        force: !!linkedCaptionClip,
      });
      const sourceStartMs = selectedAudioClip.trimStartMs;
      const sourceEndMs =
        selectedAudioClip.trimStartMs +
        Math.round(selectedAudioClip.durationMs * (selectedAudioClip.speed || 1));
      if (linkedCaptionClip) {
        onUpdateClip(linkedCaptionClip.id, {
          captionDocId: result.captionDocId,
          startMs: selectedAudioClip.startMs,
          durationMs: selectedAudioClip.durationMs,
          sourceStartMs,
          sourceEndMs,
        });
        selectClip(linkedCaptionClip.id);
      } else {
        addCaptionClip(textTrackId, {
          captionDocId: result.captionDocId,
          originVoiceoverClipId: selectedAudioClip.id,
          startMs: selectedAudioClip.startMs,
          durationMs: selectedAudioClip.durationMs,
          sourceStartMs,
          sourceEndMs,
          presetId: defaultCaptionPresetId,
        });
      }
      setCaptionSyncStatus((prev) => ({ ...prev, [selectedAudioClip.id]: "ready" }));
    } catch (error) {
      setCaptionSyncStatus((prev) => ({ ...prev, [selectedAudioClip.id]: "failed" }));
      setCaptionSyncErrors((prev) => ({
        ...prev,
        [selectedAudioClip.id]:
          error instanceof Error ? error.message : t("editor_caption_error_default"),
      }));
    }
  };

  // Transition panel
  if (selectedTransition && !selectedClip) {
    const transTrack = tracks.find((tr) =>
      (tr.transitions ?? []).some((x) => x.id === selectedTransition.id)
    );
    const clipA = transTrack?.clips.find((c) => c.id === selectedTransition.clipAId);
    const clipB = transTrack?.clips.find((c) => c.id === selectedTransition.clipBId);
    const maxDuration =
      clipA && clipB ? Math.min(clipA.durationMs, clipB.durationMs) - 100 : 2000;

    return (
      <div className="p-3">
        <InspectorSection title={t("editor_transitions_label")}>
          <InspectorPropRow label={t("editor_transitions_label")}>
            <select
              value={selectedTransition.type}
              onChange={(e) => {
                if (!transTrack) return;
                onSetTransition(
                  transTrack.id,
                  selectedTransition.clipAId,
                  selectedTransition.clipBId,
                  e.target.value as Transition["type"],
                  selectedTransition.durationMs
                );
              }}
              className="text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border border-overlay-md"
            >
              {INSPECTOR_TRANSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </InspectorPropRow>
          {selectedTransition.type !== "none" && (
            <InspectorSliderRow
              label={t("editor_transitions_duration")}
              value={selectedTransition.durationMs}
              min={200}
              max={maxDuration}
              step={100}
              onChange={(val) => {
                if (!transTrack) return;
                onSetTransition(
                  transTrack.id,
                  selectedTransition.clipAId,
                  selectedTransition.clipBId,
                  selectedTransition.type,
                  val
                );
              }}
            />
          )}
          {transTrack && selectedTransition.type !== "none" && (
            <button
              type="button"
              onClick={() => onRemoveTransition(transTrack.id, selectedTransition.id)}
              className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer px-0"
            >
              <Trash2 size={11} />
              {t("editor_transitions_remove")}
            </button>
          )}
        </InspectorSection>
      </div>
    );
  }

  if (!selectedClip) return null;

  return (
    <div className="p-3">
      {/* Clip meta: timing, speed, enabled */}
      {actualSelectedMediaClip && (
        <>
          <InspectorSection title={t("inspector_section_clip")}>
            <InspectorPropRow label={t("inspector_prop_name")}>
              <InspectorValuePill value={actualSelectedMediaClip.label} />
            </InspectorPropRow>
            <InspectorPropRow label={t("inspector_prop_start")}>
              <InspectorValuePill value={`${(actualSelectedMediaClip.startMs / 1000).toFixed(2)}s`} />
            </InspectorPropRow>
            <InspectorPropRow label={t("inspector_prop_duration")}>
              <InspectorValuePill value={`${(actualSelectedMediaClip.durationMs / 1000).toFixed(2)}s`} />
            </InspectorPropRow>
            <InspectorPropRow label={t("inspector_prop_speed")}>
              <Select
                value={String(actualSelectedMediaClip.speed)}
                onValueChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { speed: Number(v) })}
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
                checked={actualSelectedMediaClip.enabled !== false}
                onCheckedChange={(checked) =>
                  onUpdateClip(actualSelectedMediaClip.id, { enabled: checked })
                }
              />
            </InspectorPropRow>
          </InspectorSection>

          {/* Caption sync button for audio clips */}
          {selectedAudioClip && (
            <InspectorSection title={t("inspector_section_captions")}>
              <div className="space-y-2">
                <p className="text-[11px] leading-4 text-dim-3">
                  {captionActionStatus === "failed"
                    ? t("editor_caption_retry_hint", {
                        error: captionActionError || t("editor_caption_error_default"),
                      })
                    : linkedCaptionClip
                      ? t("editor_caption_refresh_hint")
                      : t("editor_caption_create_hint")}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !selectedAudioClip.assetId ||
                      !textTrackId ||
                      !defaultCaptionPresetId ||
                      transcriptionMutation.isPending ||
                      captionActionStatus === "transcribing"
                    }
                    onClick={() => void handleCaptionSync()}
                    className="h-7 px-2.5 text-xs"
                  >
                    {captionActionStatus === "failed"
                      ? t("editor_caption_retry")
                      : linkedCaptionClip
                        ? t("editor_caption_refresh")
                        : t("editor_caption_create")}
                  </Button>
                  <InspectorValuePill value={t(`editor_caption_status_${captionActionStatus}`)} />
                </div>
              </div>
            </InspectorSection>
          )}

          {/* Visual / look section */}
          <InspectorSection title={t("inspector_section_look")}>
            <InspectorSliderRow
              label={t("inspector_prop_opacity")}
              value={actualSelectedMediaClip.opacity ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { opacity: v })}
            />
            <InspectorSliderRow
              label={t("inspector_prop_warmth")}
              value={actualSelectedMediaClip.warmth ?? 0}
              min={-100}
              max={100}
              step={1}
              onChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { warmth: v })}
            />
            <InspectorSliderRow
              label={t("inspector_prop_contrast")}
              value={actualSelectedMediaClip.contrast ?? 0}
              min={-100}
              max={100}
              step={1}
              onChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { contrast: v })}
            />
          </InspectorSection>

          {/* Effects swatches for video */}
          {selectedTrack?.type === "video" && (
            <InspectorSection title={t("editor_effects_tab")}>
              <div className="flex gap-1.5 flex-wrap">
                {INSPECTOR_EFFECT_DEFINITIONS.map((effect) => (
                  <button
                    key={effect.id}
                    type="button"
                    title={t(effect.labelKey)}
                    onClick={() =>
                      onUpdateClip(actualSelectedMediaClip.id, {
                        contrast: effect.contrast ?? 0,
                        warmth: effect.warmth ?? 0,
                        opacity: effect.opacity ?? 1,
                      })
                    }
                    onMouseEnter={() =>
                      onEffectPreview?.({
                        contrast: effect.contrast ?? 0,
                        warmth: effect.warmth ?? 0,
                        opacity: effect.opacity ?? 1,
                      })
                    }
                    onMouseLeave={() => onEffectPreview?.(null)}
                    className="w-10 h-10 rounded border border-overlay-md hover:border-studio-accent/60 cursor-pointer transition-all hover:scale-105 border-0 p-0 overflow-hidden shrink-0"
                    style={{ background: effect.swatchStyle }}
                  />
                ))}
              </div>
            </InspectorSection>
          )}

          {/* Transform */}
          <InspectorSection title={t("inspector_section_transform")}>
            <InspectorPropRow label={t("inspector_prop_x")}>
              <input
                type="number"
                className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
                value={actualSelectedMediaClip.positionX ?? 0}
                onChange={(e) =>
                  onUpdateClip(actualSelectedMediaClip.id, { positionX: Number(e.target.value) })
                }
              />
            </InspectorPropRow>
            <InspectorPropRow label={t("inspector_prop_y")}>
              <input
                type="number"
                className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
                value={actualSelectedMediaClip.positionY ?? 0}
                onChange={(e) =>
                  onUpdateClip(actualSelectedMediaClip.id, { positionY: Number(e.target.value) })
                }
              />
            </InspectorPropRow>
            <InspectorSliderRow
              label={t("inspector_prop_scale")}
              value={actualSelectedMediaClip.scale ?? 1}
              min={0.1}
              max={3}
              step={0.05}
              onChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { scale: v })}
            />
            <InspectorSliderRow
              label={t("inspector_prop_rotation")}
              value={actualSelectedMediaClip.rotation ?? 0}
              min={-180}
              max={180}
              step={1}
              onChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { rotation: v })}
            />
          </InspectorSection>

          {/* Sound (media clips on any track) */}
          {isMediaTrack && (
            <InspectorSection title={t("inspector_section_sound")}>
              <InspectorSliderRow
                label={t("inspector_prop_volume")}
                value={actualSelectedMediaClip.volume}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => onUpdateClip(actualSelectedMediaClip.id, { volume: v })}
              />
              <InspectorPropRow label={t("inspector_prop_mute")}>
                <Switch
                  checked={actualSelectedMediaClip.muted}
                  onCheckedChange={(checked) =>
                    onUpdateClip(actualSelectedMediaClip.id, { muted: checked })
                  }
                />
              </InspectorPropRow>
            </InspectorSection>
          )}
        </>
      )}

      {/* Text clip sections */}
      {isTextClip(selectedClip) && (
        <>
          {isTextTrack && (
            <InspectorSection title={t("inspector_section_text")}>
              <textarea
                className="w-full text-xs bg-overlay-sm text-dim-1 px-2 py-1.5 rounded border border-overlay-md resize-none"
                rows={3}
                value={selectedClip.textContent}
                onChange={(e) => onUpdateClip(selectedClip.id, { textContent: e.target.value } as ClipPatch)}
              />
            </InspectorSection>
          )}
          <InspectorSection title={t("inspector_section_text_style")}>
            <InspectorPropRow label={t("editor_text_smart_chunks")}>
              <Switch
                checked={selectedClip.textAutoChunk === true}
                onCheckedChange={(checked) =>
                  onUpdateClip(selectedClip.id, { textAutoChunk: checked } as ClipPatch)
                }
              />
            </InspectorPropRow>
            <p className="text-[10px] text-dim-3 -mt-1 mb-2">{t("editor_text_smart_chunks_hint")}</p>
            <InspectorSliderRow
              label={t("inspector_prop_text_font_size")}
              value={selectedClip.textStyle?.fontSize ?? 32}
              min={12}
              max={120}
              step={2}
              onChange={(v) =>
                onUpdateClip(selectedClip.id, {
                  textStyle: {
                    ...selectedClip.textStyle,
                    fontSize: v,
                    fontWeight: selectedClip.textStyle?.fontWeight ?? "normal",
                    color: selectedClip.textStyle?.color ?? "#ffffff",
                    align: selectedClip.textStyle?.align ?? "center",
                  },
                } as ClipPatch)
              }
            />
            <InspectorPropRow label={t("inspector_prop_font_weight")}>
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(selectedClip.id, {
                    textStyle: {
                      fontSize: selectedClip.textStyle?.fontSize ?? 32,
                      fontWeight:
                        selectedClip.textStyle?.fontWeight === "bold" ? "normal" : "bold",
                      color: selectedClip.textStyle?.color ?? "#ffffff",
                      align: selectedClip.textStyle?.align ?? "center",
                    },
                  } as ClipPatch)
                }
                className={cn(
                  "text-xs px-2 py-0.5 rounded border cursor-pointer transition-colors",
                  selectedClip.textStyle?.fontWeight === "bold"
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
                value={selectedClip.textStyle?.color ?? "#ffffff"}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    textStyle: {
                      fontSize: selectedClip.textStyle?.fontSize ?? 32,
                      fontWeight: selectedClip.textStyle?.fontWeight ?? "normal",
                      color: e.target.value,
                      align: selectedClip.textStyle?.align ?? "center",
                    },
                  } as ClipPatch)
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
                      onUpdateClip(selectedClip.id, {
                        textStyle: {
                          fontSize: selectedClip.textStyle?.fontSize ?? 32,
                          fontWeight: selectedClip.textStyle?.fontWeight ?? "normal",
                          color: selectedClip.textStyle?.color ?? "#ffffff",
                          align: a,
                        },
                      } as ClipPatch)
                    }
                    className={cn(
                      "text-xs px-2 py-0.5 rounded border cursor-pointer transition-colors capitalize",
                      (selectedClip.textStyle?.align ?? "center") === a
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
      )}

      {/* Caption clip sections */}
      {selectedCaptionClip && (
        <>
          <CaptionLanguageScopeNotice />
          <CaptionPresetPicker
            presets={captionPresets}
            value={selectedCaptionClip.stylePresetId}
            onChange={(presetId) => updateCaptionStyle(selectedCaptionClip.id, { presetId })}
          />
          <CaptionStylePanel
            clip={selectedCaptionClip}
            onUpdateStyle={(payload) => updateCaptionStyle(selectedCaptionClip.id, payload)}
          />
          <CaptionTranscriptEditor
            doc={captionDoc ?? null}
            isSaving={updateCaptionDocMutation.isPending}
            onSave={(input) =>
              updateCaptionDocMutation.mutate({
                captionDocId: selectedCaptionClip.captionDocId,
                ...input,
              })
            }
          />
        </>
      )}
    </div>
  );
}
