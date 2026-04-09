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

interface EditorDialogsProps {
  showExport: boolean;
  editProjectId: string | null;
  resolution: string;
  fps: number;
  onCloseExport: () => void;
  scriptResetPending: unknown;
  onScriptIterationDialogOpenChange: (open: boolean) => void;
  onConfirmScriptIteration: () => void;
  publishDialogOpen: boolean;
  onPublishDialogOpenChange: (open: boolean) => void;
  isPublishing: boolean;
  isSavingPatch: boolean;
  onConfirmPublish: () => void;
}

export function EditorDialogs({
  showExport,
  editProjectId,
  resolution,
  fps,
  onCloseExport,
  scriptResetPending,
  onScriptIterationDialogOpenChange,
  onConfirmScriptIteration,
  publishDialogOpen,
  onPublishDialogOpenChange,
  isPublishing,
  isSavingPatch,
  onConfirmPublish,
}: EditorDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {showExport && editProjectId && (
        <ExportModal
          projectId={editProjectId}
          initialResolution={resolution}
          initialFps={fps as 24 | 30 | 60}
          onClose={onCloseExport}
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
            <AlertDialogAction onClick={onConfirmScriptIteration}>
              {t("editor_script_iteration_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={publishDialogOpen}
        onOpenChange={onPublishDialogOpenChange}
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
              onClick={onConfirmPublish}
            >
              {t("editor_publish_confirm_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
