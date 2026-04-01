import { useTranslation } from "react-i18next";
import type { Clip, Transition } from "../types/editor";
import { useEditorContext } from "../context/EditorContext";
import { InspectorTransitionPanel } from "./inspector/InspectorTransitionPanel";
import { InspectorClipMetaPanel } from "./inspector/InspectorClipMetaPanel";
import { InspectorClipVisualPanel } from "./inspector/InspectorClipVisualPanel";
import { InspectorTextAndCaptionPanels } from "./inspector/InspectorTextAndCaptionPanels";

interface Props {
  onEffectPreview?: (patch: Partial<Clip> | null) => void;
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
  } = useEditorContext();

  const tracks = state.tracks;
  const selectedClip = selectedClipCtx ?? undefined;

  const isTextClip = selectedTrack?.type === "text";
  const isMediaClip = !isTextClip;

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
                <InspectorClipMetaPanel
                  clip={selectedClip}
                  onUpdateClip={onUpdateClip}
                />
                <InspectorClipVisualPanel
                  clip={selectedClip}
                  trackType={selectedTrack?.type}
                  isMediaClip={isMediaClip}
                  onUpdateClip={onUpdateClip}
                  onEffectPreview={onEffectPreview}
                />
                <InspectorTextAndCaptionPanels
                  clip={selectedClip}
                  isTextClip={isTextClip}
                  onUpdateClip={onUpdateClip}
                />
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
