import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LimitHitModal({ open, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("studio_chat_limitModal_title")}</DialogTitle>
          <DialogDescription>
            {t("studio_chat_limitModal_body")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("studio_chat_limitModal_close")}
          </Button>
          <Button asChild>
            <a href="/pricing">{t("studio_chat_limitModal_upgrade")}</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
