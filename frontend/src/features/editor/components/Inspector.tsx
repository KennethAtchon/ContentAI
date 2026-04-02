import { useTranslation } from "react-i18next";
import type { ClipPatch, TimelineClip, Transition } from "../types/editor";
import { useEditorContext } from "../context/EditorContext";
import { isCaptionClip, isMediaClip } from "../utils/clip-types";
import { useCaptionPresets } from "../caption/hooks/useCaptionPresets";
import { useCaptionDoc } from "../caption/hooks/useCaptionDoc";
import { useUpdateCaptionDoc } from "../caption/hooks/useUpdateCaptionDoc";
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
