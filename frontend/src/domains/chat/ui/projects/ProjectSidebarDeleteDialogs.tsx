import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/primitives/alert-dialog";

interface ProjectSidebarDeleteDialogsProps {
  deleteProjectId: string | null;
  setDeleteProjectId: (value: string | null) => void;
  deleteSessionId: string | null;
  setDeleteSessionId: (value: string | null) => void;
  onConfirmDeleteProject: () => void;
  onConfirmDeleteSession: () => void;
  isDeletingProject: boolean;
  isDeletingSession: boolean;
  deleteSessionPreview?: {
    messages: number;
    generatedContent: number;
    editorProjects: number;
  };
  deleteSessionPreviewLoading: boolean;
  t: (key: string) => string;
}

export function ProjectSidebarDeleteDialogs({
  deleteProjectId,
  setDeleteProjectId,
  deleteSessionId,
  setDeleteSessionId,
  onConfirmDeleteProject,
  onConfirmDeleteSession,
  isDeletingProject,
  isDeletingSession,
  deleteSessionPreview,
  deleteSessionPreviewLoading,
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
            <AlertDialogTitle>
              {t("studio_chat_deleteProjectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("studio_chat_deleteProjectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingProject}>
              {t("studio_chat_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteProject}
              disabled={isDeletingProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingProject ? "Deleting..." : t("studio_chat_delete")}
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
            <AlertDialogTitle>
              {t("studio_chat_deleteSessionTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("studio_chat_deleteSessionDescription")}
            </AlertDialogDescription>
            <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
              {deleteSessionPreviewLoading ? (
                <p>Loading delete preview...</p>
              ) : (
                <>
                  <p>
                    {deleteSessionPreview?.messages ?? 0} messages will be
                    removed.
                  </p>
                  <p>
                    {deleteSessionPreview?.generatedContent ?? 0} drafts will be
                    removed.
                  </p>
                  <p>
                    {deleteSessionPreview?.editorProjects ?? 0} editor projects
                    will be removed.
                  </p>
                </>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>
              {t("studio_chat_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteSession}
              disabled={isDeletingSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSession ? "Deleting..." : t("studio_chat_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
