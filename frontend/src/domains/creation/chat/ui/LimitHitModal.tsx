import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/primitives/dialog";
import { Button } from "@/shared/ui/primitives/button";

interface Props {
  open: boolean;
  isMaxPlan?: boolean;
  onClose: () => void;
}

export function LimitHitModal({ open, isMaxPlan, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("studio_chat_limitModal_title")}</DialogTitle>
          <DialogDescription>
            {isMaxPlan
              ? t("studio_chat_limitModal_body_maxPlan")
              : t("studio_chat_limitModal_body")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("studio_chat_limitModal_close")}
          </Button>
          {!isMaxPlan && (
            <Button asChild>
              <a href="/pricing">{t("studio_chat_limitModal_upgrade")}</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
