import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/primitives/dialog";
import { Input } from "@/shared/ui/primitives/input";
import { Textarea } from "@/shared/ui/primitives/textarea";
import { Button } from "@/shared/ui/primitives/button";
import { Label } from "@/shared/ui/primitives/label";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectDescription: string;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
  isCreating?: boolean;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  projectName,
  projectDescription,
  onProjectNameChange,
  onProjectDescriptionChange,
  onCreateProject,
  isCreating = false,
}: CreateProjectModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("studio_chat_createNewProject")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onCreateProject} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("studio_chat_projectName")}</Label>
            <Input
              id="project-name"
              type="text"
              placeholder={t("studio_chat_projectName")}
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">
              {t("studio_chat_projectDescription")}
            </Label>
            <Textarea
              id="project-description"
              placeholder={t("studio_chat_projectDescription")}
              value={projectDescription}
              onChange={(e) => onProjectDescriptionChange(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              {t("studio_chat_cancel")}
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? t("studio_chat_creating") : t("studio_chat_create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
