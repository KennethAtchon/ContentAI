import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClipPatch, TimelineClip, Transition } from "../types/editor";
import { useEditorContext } from "../context/EditorContext";
import { isCaptionClip, isMediaClip } from "../utils/clip-types";
import { useCaptionPresets } from "../caption/hooks/useCaptionPresets";
import { useCaptionDoc } from "../caption/hooks/useCaptionDoc";
import { useUpdateCaptionDoc } from "../caption/hooks/useUpdateCaptionDoc";
import { useTranscription } from "../caption/hooks/useTranscription";
import { CaptionPresetPicker } from "../caption/components/CaptionPresetPicker";
import { CaptionStylePanel } from "../caption/components/CaptionStylePanel";
import { CaptionTranscriptEditor } from "../caption/components/CaptionTranscriptEditor";
import { CaptionLanguageScopeNotice } from "../caption/components/CaptionLanguageScopeNotice";
import { InspectorTransitionPanel } from "./inspector/InspectorTransitionPanel";
import { InspectorClipMetaPanel } from "./inspector/InspectorClipMetaPanel";
import { InspectorClipVisualPanel } from "./inspector/InspectorClipVisualPanel";
import { InspectorTextAndCaptionPanels } from "./inspector/InspectorTextAndCaptionPanels";

interface Props {
  onEffectPreview?: (patch: ClipPatch | null) => void;
  selectedTransition: Transition | null;
}

export function Inspector({ onEffectPreview, selectedTransition }: Props) {
  const { t } = useTranslation();
  const {
    state,
    selectedClip: selectedClipCtx,
    selectedTrack,
    updateClip: onUpdateClip,
    setTransition: onSetTransition,
    removeTransition: onRemoveTransition,
    updateCaptionStyle,
    addCaptionClip,
    selectClip,
  } = useEditorContext();

  const tracks = state.tracks;
  const selectedClip = selectedClipCtx ?? undefined;

  const isTextClip = selectedTrack?.type === "text";
  const selectedMediaClip = selectedClip && isMediaClip(selectedClip) ? selectedClip : null;
  const selectedCaptionClip = selectedClip && isCaptionClip(selectedClip) ? selectedClip : null;
  const isMediaTrack = !isTextClip;
  const { data: captionPresets = [] } = useCaptionPresets();
  const { data: captionDoc } = useCaptionDoc(selectedCaptionClip?.captionDocId ?? null);
  const updateCaptionDocMutation = useUpdateCaptionDoc();
  const transcriptionMutation = useTranscription();
  const [captionSyncStatus, setCaptionSyncStatus] = useState<
    Record<string, "idle" | "transcribing" | "ready" | "failed" | "stale">
  >({});
  const textTrackId = tracks.find((track) => track.type === "text")?.id ?? null;
  const selectedAudioClip = selectedMediaClip && selectedTrack?.type === "audio"
    ? selectedMediaClip
    : null;
  const linkedCaptionClip = useMemo(
    () =>
      selectedAudioClip
        ? tracks
            .flatMap((track) => track.clips)
            .filter(isCaptionClip)
            .find((clip) => clip.originVoiceoverClipId === selectedAudioClip.id) ?? null
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
    ? captionSyncStatus[selectedAudioClip.id] ??
      (captionClipIsStale ? "stale" : linkedCaptionClip ? "ready" : "idle")
    : "idle";

  const handleCaptionSync = async () => {
    if (!selectedAudioClip?.assetId || !textTrackId) return;

    setCaptionSyncStatus((current) => ({
      ...current,
      [selectedAudioClip.id]: "transcribing",
    }));

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
        });
      }

      setCaptionSyncStatus((current) => ({
        ...current,
        [selectedAudioClip.id]: "ready",
      }));
    } catch {
      setCaptionSyncStatus((current) => ({
        ...current,
        [selectedAudioClip.id]: "failed",
      }));
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
                {selectedMediaClip && (
                  <InspectorClipMetaPanel
                    clip={selectedMediaClip}
                    onUpdateClip={onUpdateClip}
                    captionAction={
                      selectedAudioClip
                        ? {
                            label: linkedCaptionClip
                              ? t("editor_caption_refresh")
                              : t("editor_caption_create"),
                            helperText: linkedCaptionClip
                              ? t("editor_caption_refresh_hint")
                              : t("editor_caption_create_hint"),
                            status: t(`editor_caption_status_${captionActionStatus}`),
                            disabled:
                              !selectedAudioClip.assetId ||
                              !textTrackId ||
                              transcriptionMutation.isPending ||
                              captionActionStatus === "transcribing",
                            onClick: () => {
                              void handleCaptionSync();
                            },
                          }
                        : undefined
                    }
                  />
                )}
                {selectedMediaClip && (
                  <InspectorClipVisualPanel
                    clip={selectedMediaClip}
                    trackType={selectedTrack?.type}
                    isMediaClip={isMediaTrack}
                    onUpdateClip={onUpdateClip}
                    onEffectPreview={onEffectPreview}
                  />
                )}
                <InspectorTextAndCaptionPanels
                  clip={selectedClip}
                  isTextClip={isTextClip}
                  onUpdateClip={onUpdateClip}
                />
                {selectedCaptionClip && (
                  <>
                    <CaptionLanguageScopeNotice />
                    <CaptionPresetPicker
                      presets={captionPresets}
                      value={selectedCaptionClip.stylePresetId}
                      onChange={(presetId) =>
                        updateCaptionStyle(selectedCaptionClip.id, { presetId })
                      }
                    />
                    <CaptionStylePanel
                      clip={selectedCaptionClip}
                      onUpdateStyle={(payload) =>
                        updateCaptionStyle(selectedCaptionClip.id, payload)
                      }
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
              </>
            )}

            {selectedTransition && (
              <InspectorTransitionPanel
                tracks={tracks}
                selectedTransition={selectedTransition}
                onSetTransition={onSetTransition}
                onRemoveTransition={onRemoveTransition}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
