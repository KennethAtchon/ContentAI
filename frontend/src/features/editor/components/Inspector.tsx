import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { Clip, Track, Transition } from "../types/editor";
import { CAPTION_PRESETS } from "../constants/caption-presets";
import { CaptionPresetTile } from "./CaptionPresetTile";

interface Props {
  tracks: Track[];
  selectedClipId: string | null;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  selectedTransition: Transition | null;
  onSetTransition: (
    trackId: string,
    clipAId: string,
    clipBId: string,
    type: Transition["type"],
    durationMs: number
  ) => void;
  onRemoveTransition: (trackId: string, transitionId: string) => void;
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

export function Inspector({
  tracks,
  selectedClipId,
  onUpdateClip,
  selectedTransition,
  onSetTransition,
  onRemoveTransition,
}: Props) {
  const { t } = useTranslation();

  let selectedClip: Clip | undefined;
  for (const track of tracks) {
    const found = track.clips.find((c) => c.id === selectedClipId);
    if (found) {
      selectedClip = found;
      break;
    }
  }

  const isCaptionClip = !!(selectedClip?.captionWords?.length);

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-overlay-sm bg-studio-surface"
      style={{ width: 244 }}
    >
      <div className="px-4 py-2 border-b border-overlay-sm shrink-0">
        <p className="text-xs font-semibold text-dim-2 tracking-wider uppercase">
          Inspector
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
                <Section title="Clip">
                  <PropRow label="Name">
                    <ValuePill value={selectedClip.label} />
                  </PropRow>
                  <PropRow label="Start">
                    <ValuePill value={`${(selectedClip.startMs / 1000).toFixed(2)}s`} />
                  </PropRow>
                  <PropRow label="Duration">
                    <ValuePill value={`${(selectedClip.durationMs / 1000).toFixed(2)}s`} />
                  </PropRow>
                  <PropRow label="Speed">
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
                  <PropRow label="Enabled">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateClip(selectedClip!.id, {
                          enabled: selectedClip!.enabled === false ? true : false,
                        })
                      }
                      className={cn(
                        "relative w-11 h-5 rounded-full cursor-pointer transition-colors shrink-0",
                        selectedClip.enabled !== false
                          ? "bg-studio-accent border border-studio-accent"
                          : "bg-transparent border border-overlay-lg"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform",
                          selectedClip.enabled !== false
                            ? "bg-white translate-x-[1.375rem]"
                            : "bg-dim-3 translate-x-0"
                        )}
                      />
                    </button>
                  </PropRow>
                </Section>

                {/* 2. Look */}
                <Section title="Look">
                  <SliderRow
                    label="Opacity"
                    value={selectedClip.opacity ?? 1}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { opacity: v })}
                  />
                  <SliderRow
                    label="Warmth"
                    value={selectedClip.warmth ?? 0}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { warmth: v })}
                  />
                  <SliderRow
                    label="Contrast"
                    value={selectedClip.contrast ?? 0}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { contrast: v })}
                  />
                </Section>

                {/* 3. Transform */}
                <Section title="Transform">
                  <PropRow label="X">
                    <input
                      type="number"
                      className="w-16 text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0"
                      value={selectedClip.positionX ?? 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip!.id, { positionX: Number(e.target.value) })
                      }
                    />
                  </PropRow>
                  <PropRow label="Y">
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
                    label="Scale"
                    value={selectedClip.scale ?? 1}
                    min={0.1}
                    max={3}
                    step={0.05}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { scale: v })}
                  />
                  <SliderRow
                    label="Rotation"
                    value={selectedClip.rotation ?? 0}
                    min={-180}
                    max={180}
                    step={1}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { rotation: v })}
                  />
                </Section>

                {/* 4. Sound */}
                <Section title="Sound">
                  <SliderRow
                    label="Volume"
                    value={selectedClip.volume ?? 1}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(v) => onUpdateClip(selectedClip!.id, { volume: v })}
                  />
                  <PropRow label="Mute">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateClip(selectedClip!.id, { muted: !selectedClip!.muted })
                      }
                      className={cn(
                        "relative w-11 h-5 rounded-full cursor-pointer transition-colors shrink-0",
                        selectedClip.muted
                          ? "bg-studio-accent border border-studio-accent"
                          : "bg-transparent border border-overlay-lg"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform",
                          selectedClip.muted
                            ? "bg-white translate-x-[1.375rem]"
                            : "bg-dim-3 translate-x-0"
                        )}
                      />
                    </button>
                  </PropRow>

                  {selectedClip.textContent !== undefined && (
                    <div className="mt-2">
                      <p className="text-xs text-dim-3 mb-1">Text</p>
                      <textarea
                        className="w-full text-xs bg-overlay-sm text-dim-1 px-2 py-1.5 rounded border border-overlay-md resize-none"
                        rows={3}
                        value={selectedClip.textContent}
                        onChange={(e) =>
                          onUpdateClip(selectedClip!.id, { textContent: e.target.value })
                        }
                      />
                    </div>
                  )}
                </Section>

                {/* 5. Captions — only for caption clips */}
                {isCaptionClip && (
                  <Section title="Captions">
                    {/* Preset picker */}
                    <div className="mb-2">
                      <p className="text-[10px] text-dim-3 mb-1.5">{t("editor_captions_style")}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {CAPTION_PRESETS.map((p) => (
                          <CaptionPresetTile
                            key={p.id}
                            preset={p}
                            selected={selectedClip.captionPresetId === p.id}
                            onClick={() =>
                              onUpdateClip(selectedClip!.id, { captionPresetId: p.id })
                            }
                            compact
                          />
                        ))}
                      </div>
                    </div>
                    <SliderRow
                      label="Position Y"
                      value={selectedClip.captionPositionY ?? 80}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        onUpdateClip(selectedClip!.id, { captionPositionY: v })
                      }
                    />
                    <SliderRow
                      label="Font Size"
                      value={selectedClip.captionFontSizeOverride ?? 48}
                      min={16}
                      max={120}
                      step={2}
                      onChange={(v) =>
                        onUpdateClip(selectedClip!.id, { captionFontSizeOverride: v })
                      }
                    />
                    <SliderRow
                      label="Group Size"
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
                  label: string;
                }[] = [
                  { value: "none", label: "Cut" },
                  { value: "fade", label: "Fade" },
                  { value: "slide-left", label: "Slide Left" },
                  { value: "slide-up", label: "Slide Up" },
                  { value: "dissolve", label: "Dissolve" },
                  { value: "wipe-right", label: "Wipe Right" },
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
                            {opt.label}
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
                        Remove Transition
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
