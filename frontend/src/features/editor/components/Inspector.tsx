import { useTranslation } from "react-i18next";
import { Trash2, Loader2, Captions } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { Clip, Transition } from "../types/editor";
import { CAPTION_PRESETS } from "../constants/caption-presets";
import { CaptionPresetTile } from "./CaptionPresetTile";
import { useAutoCaption } from "../hooks/useCaptions";
import { useEditorContext } from "../context/EditorContext";


const EFFECT_DEFINITIONS: {
  id: string;
  labelKey: string;
  contrast: number;
  warmth: number;
  opacity: number;
  swatchStyle: string;
}[] = [
  {
    id: "color-grade",
    labelKey: "editor_effect_color_grade",
    contrast: 20,
    warmth: 10,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)",
  },
  {
    id: "bw",
    labelKey: "editor_effect_bw",
    contrast: 10,
    warmth: -100,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #1a1a1a 0%, #888888 100%)",
  },
  {
    id: "warm",
    labelKey: "editor_effect_warm",
    warmth: 40,
    contrast: 5,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
  },
  {
    id: "cool",
    labelKey: "editor_effect_cool",
    warmth: -40,
    contrast: 5,
    opacity: 1,
    swatchStyle: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  },
  {
    id: "vignette",
    labelKey: "editor_effect_vignette",
    opacity: 0.9,
    contrast: 15,
    warmth: 0,
    swatchStyle: "radial-gradient(ellipse at center, #555 0%, #000 100%)",
  },
];

interface Props {
  onEffectPreview?: (patch: Partial<Clip> | null) => void;
  selectedTransition: Transition | null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-dashed border-overlay-sm pb-3 mb-3">
      <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 min-w-0">
      <span className="text-xs text-dim-2 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-dim-2 w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-studio-accent"
      />
      <span className="text-xs text-dim-3 w-8 text-right">{value}</span>
    </div>
  );
}

function ValuePill({ value }: { value: string | number }) {
  return (
    <span className="text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded">
      {value}
    </span>
  );
}

export function Inspector({ onEffectPreview, selectedTransition }: Props) {
  const { t } = useTranslation();
  const autoCaption = useAutoCaption();
  const {
    state,
    selectedClip: selectedClipCtx,
    selectedTrack,
    updateClip: onUpdateClip,
    addCaptionClip: onAddCaptionClip,
    setTransition: onSetTransition,
    removeTransition: onRemoveTransition,
  } = useEditorContext();

  const tracks = state.tracks;
  const selectedClip = selectedClipCtx ?? undefined;

  const isTextClip = selectedTrack?.type === "text";
  const isMediaClip = !isTextClip;

  /** Word-timed captions (preview canvas + generate-from-video exclusion). */
  const hasTimedCaptionWords = !!(selectedClip?.captionWords?.length);
  /** Caption preset UI applies to every text-track clip, not only after words exist. */
  const showCaptionStyleUi = selectedTrack?.type === "text";

  // Show generate button for any non-text track clip that has an asset and no captions yet
  const isGenerableClip =
    !!selectedClip?.assetId &&
    selectedTrack?.type !== "text" &&
    !hasTimedCaptionWords;

  const handleGenerateText = async () => {
    if (!selectedClip?.assetId) return;
    try {
      const result = await autoCaption.mutateAsync(selectedClip.assetId);
      const durationMs =
        result.words.length > 0
          ? result.words[result.words.length - 1].endMs
          : selectedClip.durationMs;
      onAddCaptionClip({
        captionId: result.captionId,
        captionWords: result.words,
        assetId: selectedClip.assetId,
        presetId: "hormozi",
        startMs: selectedClip.startMs,
        durationMs,
      });
    } catch {
      // error surfaced via autoCaption.isError below
    }
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-overlay-sm bg-studio-surface"
      style={{ width: 244 }}
    >
      <div className="px-4 py-2 border-b border-overlay-sm shrink-0">
        <p className="text-xs font-semibold text-dim-2 tracking-wider uppercase">
          {t("inspector_title")}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {!selectedClip && !selectedTransition ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
            <span className="text-4xl opacity-20">✦</span>
            <p className="text-xs italic text-dim-3 text-center">
              {t("editor_inspector_empty")}
            </p>
          </div>
        ) : (
          <div className="p-3">
            {selectedClip && (
              <>
                {/* 1. Clip */}
                <Section title={t("inspector_section_clip")}>
                  <PropRow label={t("inspector_prop_name")}>
                    <ValuePill value={selectedClip.label} />
                  </PropRow>
                  <PropRow label={t("inspector_prop_start")}>
                    <ValuePill value={`${(selectedClip.startMs / 1000).toFixed(2)}s`} />
                  </PropRow>
                  <PropRow label={t("inspector_prop_duration")}>
                    <ValuePill value={`${(selectedClip.durationMs / 1000).toFixed(2)}s`} />
                  </PropRow>
                  <PropRow label={t("inspector_prop_speed")}>
                    <Select
                      value={String(selectedClip.speed)}
                      onValueChange={(v) =>
                        onUpdateClip(selectedClip!.id, { speed: Number(v) })
                      }
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
                  </PropRow>
                  <PropRow label={t("inspector_prop_enabled")}>
                    <Switch
                      checked={selectedClip.enabled !== false}
                      onCheckedChange={(checked) =>
                        onUpdateClip(selectedClip!.id, { enabled: checked })
                      }
                    />
                  </PropRow>
                </Section>

                {/* Generate text — video/audio clips only */}
                {isGenerableClip && (
                  <Section title={t("editor_captions_generate_section")}>
                    {autoCaption.isError && (
                      <p className="text-[11px] text-red-400 mb-2">
                        {t("editor_captions_failed")}
                      </p>
                    )}
                    <button
                      onClick={handleGenerateText}
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
                  </Section>
                )}

                {/* 2. Look */}
                <Section title={t("inspector_section_look")}>
                  <SliderRow
                    label={t("inspector_prop_opacity")}
                    value={selectedClip.opacity ?? 1}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { opacity: v })}
                  />
                  <SliderRow
                    label={t("inspector_prop_warmth")}
                    value={selectedClip.warmth ?? 0}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { warmth: v })}
                  />
                  <SliderRow
                    label={t("inspector_prop_contrast")}
                    value={selectedClip.contrast ?? 0}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { contrast: v })}
                  />
                </Section>

                {/* 3. Effects — video clips only */}
                {selectedTrack?.type === "video" && (
                  <Section title={t("editor_effects_tab")}>
                    <div className="flex gap-1.5 flex-wrap">
                      {EFFECT_DEFINITIONS.map((effect) => (
                        <button
                          key={effect.id}
                          title={t(effect.labelKey)}
                          onClick={() =>
                            onUpdateClip(selectedClip!.id, {
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
                  </Section>
                )}

                {/* 4. Transform */}
                <Section title={t("inspector_section_transform")}>
                  <PropRow label={t("inspector_prop_x")}>
                    <input
                      type="number"
                      className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
                      value={selectedClip.positionX ?? 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip!.id, { positionX: Number(e.target.value) })
                      }
                    />
                  </PropRow>
                  <PropRow label={t("inspector_prop_y")}>
                    <input
                      type="number"
                      className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
                      value={selectedClip.positionY ?? 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip!.id, { positionY: Number(e.target.value) })
                      }
                    />
                  </PropRow>
                  <SliderRow
                    label={t("inspector_prop_scale")}
                    value={selectedClip.scale ?? 1}
                    min={0.1}
                    max={3}
                    step={0.05}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { scale: v })}
                  />
                  <SliderRow
                    label={t("inspector_prop_rotation")}
                    value={selectedClip.rotation ?? 0}
                    min={-180}
                    max={180}
                    step={1}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { rotation: v })}
                  />
                </Section>

                {/* 4. Sound — not applicable to text clips */}
                {isMediaClip && (
                  <Section title={t("inspector_section_sound")}>
                    <SliderRow
                      label={t("inspector_prop_volume")}
                      value={selectedClip.volume ?? 1}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={(v) => onUpdateClip(selectedClip!.id, { volume: v })}
                    />
                    <PropRow label={t("inspector_prop_mute")}>
                      <Switch
                        checked={selectedClip.muted ?? false}
                        onCheckedChange={(checked) =>
                          onUpdateClip(selectedClip!.id, { muted: checked })
                        }
                      />
                    </PropRow>
                  </Section>
                )}

                {/* 5. Text — only for text clips */}
                {isTextClip && selectedClip.textContent !== undefined && (
                  <Section title={t("inspector_section_text")}>
                    <textarea
                      className="w-full text-xs bg-overlay-sm text-dim-1 px-2 py-1.5 rounded border border-overlay-md resize-none"
                      rows={3}
                      value={selectedClip.textContent}
                      onChange={(e) =>
                        onUpdateClip(selectedClip!.id, { textContent: e.target.value })
                      }
                    />
                  </Section>
                )}

                {/* 4b. Text Style — plain overlay copy (no word-timed captions) */}
                {selectedClip.textContent !== undefined && !hasTimedCaptionWords && (
                  <Section title={t("inspector_section_text_style")}>
                    <PropRow label={t("editor_text_smart_chunks")}>
                      <Switch
                        checked={selectedClip.textAutoChunk === true}
                        onCheckedChange={(checked) =>
                          onUpdateClip(selectedClip!.id, { textAutoChunk: checked })
                        }
                      />
                    </PropRow>
                    <p className="text-[10px] text-dim-3 -mt-1 mb-2">
                      {t("editor_text_smart_chunks_hint")}
                    </p>
                    <SliderRow
                      label={t("inspector_prop_text_font_size")}
                      value={selectedClip.textStyle?.fontSize ?? 32}
                      min={12}
                      max={120}
                      step={2}
                      onChange={(v) =>
                        onUpdateClip(selectedClip!.id, {
                          textStyle: { ...selectedClip!.textStyle, fontSize: v, fontWeight: selectedClip!.textStyle?.fontWeight ?? "normal", color: selectedClip!.textStyle?.color ?? "#ffffff", align: selectedClip!.textStyle?.align ?? "center" },
                        })
                      }
                    />
                    <PropRow label={t("inspector_prop_font_weight")}>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip!.id, {
                            textStyle: { fontSize: selectedClip!.textStyle?.fontSize ?? 32, fontWeight: selectedClip!.textStyle?.fontWeight === "bold" ? "normal" : "bold", color: selectedClip!.textStyle?.color ?? "#ffffff", align: selectedClip!.textStyle?.align ?? "center" },
                          })
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
                    </PropRow>
                    <PropRow label={t("inspector_prop_text_color")}>
                      <input
                        type="color"
                        value={selectedClip.textStyle?.color ?? "#ffffff"}
                        onChange={(e) =>
                          onUpdateClip(selectedClip!.id, {
                            textStyle: { fontSize: selectedClip!.textStyle?.fontSize ?? 32, fontWeight: selectedClip!.textStyle?.fontWeight ?? "normal", color: e.target.value, align: selectedClip!.textStyle?.align ?? "center" },
                          })
                        }
                        className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </PropRow>
                    <PropRow label={t("inspector_prop_text_align")}>
                      <div className="flex gap-1">
                        {(["left", "center", "right"] as const).map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() =>
                              onUpdateClip(selectedClip!.id, {
                                textStyle: { fontSize: selectedClip!.textStyle?.fontSize ?? 32, fontWeight: selectedClip!.textStyle?.fontWeight ?? "normal", color: selectedClip!.textStyle?.color ?? "#ffffff", align: a },
                              })
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
                    </PropRow>
                  </Section>
                )}

                {/* 5. Captions — text track (preset applies to export / word-timed preview) */}
                {showCaptionStyleUi && (
                  <Section title={t("editor_captions_generate_section")}>
                    {/* Preset picker */}
                    <div className="mb-2">
                      <p className="text-[10px] text-dim-3 mb-1.5">{t("editor_captions_style")}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {CAPTION_PRESETS.map((p) => (
                          <CaptionPresetTile
                            key={p.id}
                            preset={p}
                            selected={
                              (selectedClip.captionPresetId ?? CAPTION_PRESETS[0]!.id) === p.id
                            }
                            onClick={() =>
                              onUpdateClip(selectedClip!.id, { captionPresetId: p.id })
                            }
                            compact
                          />
                        ))}
                      </div>
                    </div>
                    <SliderRow
                      label={t("inspector_prop_caption_position_y")}
                      value={selectedClip.captionPositionY ?? 80}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        onUpdateClip(selectedClip!.id, { captionPositionY: v })
                      }
                    />
                    <SliderRow
                      label={t("inspector_prop_caption_font_size")}
                      value={selectedClip.captionFontSizeOverride ?? 48}
                      min={16}
                      max={120}
                      step={2}
                      onChange={(v) =>
                        onUpdateClip(selectedClip!.id, { captionFontSizeOverride: v })
                      }
                    />
                    <SliderRow
                      label={t("inspector_prop_caption_group_size")}
                      value={selectedClip.captionGroupSize ?? 3}
                      min={1}
                      max={6}
                      step={1}
                      onChange={(v) =>
                        onUpdateClip(selectedClip!.id, { captionGroupSize: v })
                      }
                    />
                  </Section>
                )}
              </>
            )}

            {/* Transition section */}
            {selectedTransition &&
              (() => {
                const transTrack = tracks.find((t) =>
                  (t.transitions ?? []).some((tr) => tr.id === selectedTransition.id)
                );
                const clipA = transTrack?.clips.find(
                  (c) => c.id === selectedTransition.clipAId
                );
                const clipB = transTrack?.clips.find(
                  (c) => c.id === selectedTransition.clipBId
                );
                const maxDuration =
                  clipA && clipB
                    ? Math.min(clipA.durationMs, clipB.durationMs) - 100
                    : 2000;

                const TRANSITION_OPTIONS: {
                  value: Transition["type"];
                  labelKey: string;
                }[] = [
                  { value: "none", labelKey: "editor_transitions_cut" },
                  { value: "fade", labelKey: "editor_transitions_fade" },
                  { value: "slide-left", labelKey: "editor_transitions_slide_left" },
                  { value: "slide-up", labelKey: "editor_transitions_slide_up" },
                  { value: "dissolve", labelKey: "editor_transitions_dissolve" },
                  { value: "wipe-right", labelKey: "editor_transitions_wipe_right" },
                ];

                return (
                  <Section title={t("editor_transitions_label")}>
                    <PropRow label={t("editor_transitions_label")}>
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
                        {TRANSITION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </PropRow>

                    {selectedTransition.type !== "none" && (
                      <SliderRow
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
                        onClick={() =>
                          onRemoveTransition(transTrack.id, selectedTransition.id)
                        }
                        className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer px-0"
                      >
                        <Trash2 size={11} />
                        {t("editor_transitions_remove")}
                      </button>
                    )}
                  </Section>
                );
              })()}
          </div>
        )}
      </div>
    </div>
  );
}
