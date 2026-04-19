import { useTranslation } from "react-i18next";
import { ArrowLeft, Undo2, Redo2, Upload, Lock, FilePlus, Check, Loader2 } from "lucide-react";
import { useEditorDocumentContext } from "../../context/EditorDocumentContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { useEditorPersistContext } from "../../context/EditorPersistContext";
import { useEditorUIContext } from "../../context/EditorUIContext";

export function EditorHeader() {
  const { t } = useTranslation();
  const { title, isReadOnly, past, future, setTitle, undo, redo } =
    useEditorDocumentContext();
  const { handleBack, saveNow } = useEditorPlaybackContext();
  const { isDirty, isSavingPatch, lastSavedAt } = useEditorPersistContext();
  const {
    showExport,
    setShowExport,
    publishDialogOpen,
    setPublishDialogOpen,
    isPublishing,
    isCreatingDraft,
    createNewDraft,
  } = useEditorUIContext();

  void showExport;
  void publishDialogOpen;

  return (
    <div
      className="flex items-center gap-0 px-3 border-b border-overlay-sm bg-studio-topbar shrink-0"
      style={{ height: 48 }}
    >
      <button
        onClick={() => void handleBack()}
        title={t("editor_back")}
        className="transport-btn mr-1"
      >
        <ArrowLeft size={15} />
      </button>

      <div className="w-px h-5 bg-overlay-md mx-2 shrink-0" />

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        readOnly={isReadOnly}
        className="bg-transparent border-0 border-b border-overlay-md text-sm text-dim-1 min-w-[160px] max-w-[260px] outline-none focus:border-studio-accent transition-colors px-1 read-only:border-transparent read-only:cursor-default"
      />

      <div className="ml-2 min-w-[80px]">
        {isSavingPatch ? (
          <span className="flex items-center gap-1 text-xs text-dim-3">
            <Loader2 size={11} className="animate-spin" />
            {t("editor_saving")}
          </span>
        ) : isDirty ? (
          <button
            onClick={saveNow}
            className="px-2 py-0.5 text-xs rounded bg-amber-400/15 border border-amber-400/30 text-amber-400 cursor-pointer hover:bg-amber-400/25 transition-colors"
          >
            {t("editor_save_now")}
          </button>
        ) : lastSavedAt ? (
          <span className="flex items-center gap-1 text-xs text-dim-3">
            <Check size={11} className="text-green-500" />
            {t("editor_saved")}
          </span>
        ) : null}
      </div>

      <div className="flex-1" />

      <button
        onClick={undo}
        disabled={past.length === 0}
        title={t("editor_transport_undo")}
        className="transport-btn disabled:opacity-30"
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={redo}
        disabled={future.length === 0}
        title={t("editor_transport_redo")}
        className="transport-btn disabled:opacity-30"
      >
        <Redo2 size={14} />
      </button>

      <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

      {isReadOnly ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-green-500/15 text-green-400 uppercase tracking-wide">
            <Lock size={11} />
            {t("editor_status_published")}
          </span>
          <button
            onClick={createNewDraft}
            disabled={isCreatingDraft}
            className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-60"
          >
            <FilePlus size={14} />
            {t("editor_new_draft")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg cursor-pointer hover:bg-overlay-md transition-colors"
          >
            <Upload size={14} />
            {t("editor_export_button")}
          </button>
          <button
            type="button"
            onClick={() => setPublishDialogOpen(true)}
            disabled={isPublishing || isSavingPatch}
            title={
              isPublishing
                ? "Publishing..."
                : isSavingPatch
                  ? "Wait for autosave to finish before publishing."
                  : t("editor_publish_button")
            }
            className="flex items-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-4 py-1.5 rounded-lg border-0 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {t("editor_publish_button")}
          </button>
        </div>
      )}
    </div>
  );
}
