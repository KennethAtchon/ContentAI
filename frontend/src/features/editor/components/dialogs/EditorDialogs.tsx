import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { ExportModal } from "./ExportModal";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { useEditorUIContext } from "../../context/EditorUIContext";
import { useEditorPersistContext } from "../../context/EditorPersistContext";
import { useAssetUrlMap } from "../../contexts/asset-url-map-context";

export function EditorDialogs() {
  const { t } = useTranslation();
  const { editProjectId, resolution, fps, tracks, durationMs } =
    useEditorDocumentState();
  const assetUrlMap = useAssetUrlMap();
  const { handleConfirmPublish } = useEditorPlaybackContext();
  const {
    showExport,
    setShowExport,
    publishDialogOpen,
    setPublishDialogOpen,
    scriptResetPending,
    onScriptIterationDialogOpenChange,
    confirmScriptIteration,
    isPublishing,
  } = useEditorUIContext();
  const { isSavingPatch } = useEditorPersistContext();

  return (
    <>
      {showExport && editProjectId && (
        <ExportModal
          projectId={editProjectId}
          tracks={tracks}
          durationMs={durationMs}
          assetUrlMap={assetUrlMap}
          initialResolution={resolution}
          initialFps={fps as 24 | 30 | 60}
          onClose={() => setShowExport(false)}
        />
      )}

      <AlertDialog
        open={!!scriptResetPending}
        onOpenChange={onScriptIterationDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("editor_script_iteration_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("editor_script_iteration_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmScriptIteration}>
              {t("editor_script_iteration_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("editor_publish_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("editor_publish_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPublishing || isSavingPatch}
              onClick={() => void handleConfirmPublish()}
            >
              {t("editor_publish_confirm_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
