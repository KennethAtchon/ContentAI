import { useTranslation } from "react-i18next";
import type { CompositionRecord, Timeline } from "../../types/composition.types";
import { TimelineStrip } from "./TimelineStrip";

export type PreviewPanelProps = {
  composition: CompositionRecord;
  onTimelineChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  onSelectVideoClip: (clipId: string) => void;
};

export function PreviewPanel({
  composition,
  onTimelineChange,
  selectedVideoClipId,
  onSelectVideoClip,
}: PreviewPanelProps) {
  const { t } = useTranslation();
  const clipCount = composition.timeline.tracks.video.length;
  const audioCount = composition.timeline.tracks.audio.length;
  const textCount = composition.timeline.tracks.text.length;
  const captionsEnabled = Boolean(
    (composition.timeline.tracks.captions[0] as Record<string, unknown> | undefined)
      ?.enabled,
  );

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_preview")}
      </p>
      <div className="mt-2 space-y-1 text-xs text-foreground/80">
        <p>{t("phase5_editor_duration", { ms: composition.timeline.durationMs })}</p>
        <p>{t("phase5_editor_clip_count", { count: clipCount })}</p>
        <p>{t("phase5_editor_audio_count", { count: audioCount })}</p>
        <p>{t("phase5_editor_text_count", { count: textCount })}</p>
        <p>
          {captionsEnabled
            ? t("phase5_editor_captions_on")
            : t("phase5_editor_captions_off")}
        </p>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {t("phase5_editor_preview_placeholder")}
      </p>
      <TimelineStrip
        timeline={composition.timeline}
        onChange={onTimelineChange}
        selectedVideoClipId={selectedVideoClipId}
        onSelectVideoClip={onSelectVideoClip}
      />
    </section>
  );
}
