import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import { Textarea } from "@/shared/ui/primitives/textarea";
import { Switch } from "@/shared/ui/primitives/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/primitives/dialog";
import {
  useUpdateNiche,
  type AdminNiche,
} from "@/domains/admin/hooks/use-niches";

// ── Edit Modal ────────────────────────────────────────────────────────────────

export function NicheEditModal({
  niche,
  open,
  onClose,
}: {
  niche: AdminNiche;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(niche.name);
  const [description, setDescription] = useState(niche.description ?? "");
  const [isActive, setIsActive] = useState(niche.isActive);
  const [error, setError] = useState("");
  const update = useUpdateNiche();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      await update.mutateAsync({ id: niche.id, name, description, isActive });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin_niche_edit_modal_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-base text-dim-1">
              {isActive ? t("common_active") : t("common_unavailable")}
            </span>
          </div>
          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? `${t("common_save")}…` : t("common_save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
