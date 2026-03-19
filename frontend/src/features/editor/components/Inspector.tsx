import { useTranslation } from "react-i18next";
import type { Clip, Track } from "../types/editor";

interface Props {
  tracks: Track[];
  selectedClipId: string | null;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-dashed border-overlay-sm pb-3 mb-3">
      <p className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
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
    <span className="text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded">{value}</span>
  );
}

export function Inspector({ tracks, selectedClipId, onUpdateClip }: Props) {
  const { t } = useTranslation();

  // Find selected clip
  let selectedClip: Clip | undefined;
  for (const track of tracks) {
    const found = track.clips.find((c) => c.id === selectedClipId);
    if (found) {
      selectedClip = found;
      break;
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-overlay-sm bg-studio-surface" style={{ width: 244 }}>
      {/* Header */}
      <div className="px-4 py-2 border-b border-overlay-sm shrink-0">
        <p className="text-xs italic text-dim-2 font-serif">Inspector</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedClip ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
            <span className="text-4xl opacity-20">✦</span>
            <p className="text-xs italic text-dim-3 text-center">
              {t("editor_inspector_empty")}
            </p>
          </div>
        ) : (
          /* Populated state */
          <div className="p-3">
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
                <select
                  className="text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded border-0 cursor-pointer"
                  value={selectedClip.speed}
                  onChange={(e) =>
                    onUpdateClip(selectedClip!.id, { speed: Number(e.target.value) })
                  }
                >
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
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
                  onClick={() =>
                    onUpdateClip(selectedClip!.id, { muted: !selectedClip!.muted })
                  }
                  className={[
                    "relative w-10 h-5 rounded-full border-0 cursor-pointer transition-colors",
                    selectedClip.muted ? "bg-studio-accent" : "bg-overlay-md",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      selectedClip.muted ? "translate-x-5" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </PropRow>

              {/* Text content for text clips */}
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
          </div>
        )}
      </div>
    </div>
  );
}
