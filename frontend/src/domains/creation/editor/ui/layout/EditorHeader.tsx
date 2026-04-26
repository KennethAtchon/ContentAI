import {
  ArrowLeft,
  Check,
  FilePlus,
  Lock,
  Redo2,
  Undo2,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorUIStore } from "../../store/editor-ui-store";

interface EditorHeaderProps {
  onBack?: () => void;
}

export function EditorHeader({ onBack }: EditorHeaderProps) {
  const { t } = useTranslation();
  const title = useEditorProjectStore((state) => state.title);
  const isReadOnly = useEditorProjectStore((state) => state.isReadOnly);
  const canUndo = useEditorProjectStore((state) => state.past.length > 0);
  const canRedo = useEditorProjectStore((state) => state.future.length > 0);
  const setTitle = useEditorProjectStore((state) => state.setTitle);
  const undo = useEditorProjectStore((state) => state.undo);
  const redo = useEditorProjectStore((state) => state.redo);
  const openExportModal = useEditorUIStore((state) => state.openExportModal);

  return (
    <div
      className="flex items-center gap-0 px-3 border-b border-overlay-sm bg-studio-topbar shrink-0"
      style={{ height: 48 }}
    >
      <button
        onClick={onBack}
        title={t("editor_back")}
        className="transport-btn"
      >
        <ArrowLeft size={15} />
      </button>

      <div className="w-px h-5 bg-overlay-md mx-2 shrink-0" />

      <input
        type="text"
        value={title}
        readOnly={isReadOnly}
        onChange={(event) => setTitle(event.target.value)}
        className="bg-transparent border-0 border-b border-transparent text-sm text-dim-1 min-w-[160px] max-w-[260px] outline-none px-1 read-only:cursor-default"
      />

      <span className="ml-3 flex items-center gap-1 text-xs text-dim-3">
        <Check size={11} className="text-green-500" />
        {t("editor_saved")}
      </span>

      <div className="flex-1" />

      <button
        disabled={!canUndo}
        onClick={undo}
        title={t("editor_transport_undo")}
        className={canUndo ? "transport-btn" : "transport-btn opacity-30"}
      >
        <Undo2 size={14} />
      </button>
      <button
        disabled={!canRedo}
        onClick={redo}
        title={t("editor_transport_redo")}
        className={canRedo ? "transport-btn" : "transport-btn opacity-30"}
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
          <button className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg">
            <FilePlus size={14} />
            {t("editor_new_draft")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={openExportModal}
            className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg"
          >
            <Upload size={14} />
            {t("editor_export_button")}
          </button>
          <button className="flex items-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-4 py-1.5 rounded-lg border-0">
            {t("editor_publish_button")}
          </button>
        </div>
      )}
    </div>
  );
}
