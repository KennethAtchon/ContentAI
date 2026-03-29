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

interface ProjectSidebarDeleteDialogsProps {
  deleteProjectId: string | null;
  setDeleteProjectId: (value: string | null) => void;
  deleteSessionId: string | null;
  setDeleteSessionId: (value: string | null) => void;
  onConfirmDeleteProject: () => void;
  onConfirmDeleteSession: () => void;
  t: (key: string) => string;
}

export function ProjectSidebarDeleteDialogs({
  deleteProjectId,
  setDeleteProjectId,
  deleteSessionId,
  setDeleteSessionId,
  onConfirmDeleteProject,
  onConfirmDeleteSession,
  t,
}: ProjectSidebarDeleteDialogsProps) {
  return (
    <>
      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studio_chat_deleteProjectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("studio_chat_deleteProjectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("studio_chat_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("studio_chat_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteSessionId}
        onOpenChange={(open) => !open && setDeleteSessionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studio_chat_deleteSessionTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("studio_chat_deleteSessionDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("studio_chat_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("studio_chat_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

