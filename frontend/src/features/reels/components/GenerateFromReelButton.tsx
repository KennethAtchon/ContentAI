import { useState } from "react";
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
import { useGenerateFromReel } from "../hooks/use-generate-from-reel";
import type { ReelDetail, ReelAnalysis } from "../types/reel.types";

interface Props {
  reel: ReelDetail;
  analysis: ReelAnalysis | null;
}

export function GenerateFromReelButton({ reel, analysis }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { generateFromReel, isLoading, error } = useGenerateFromReel();

  async function handleContinue() {
    await generateFromReel(reel, analysis);
    // If no error, navigation happens automatically
    if (!error) setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-studio-accent/[0.12] border border-studio-accent/40 rounded-[10px] text-studio-accent text-[12px] font-semibold py-3.5 flex items-center justify-center gap-1.5 cursor-pointer font-studio transition-all duration-150 hover:bg-studio-accent/[0.20] hover:border-studio-accent/60"
      >
        ✦ {t("studio_panel_generateFromReel")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("studio_panel_generateModal_title")}</DialogTitle>
            <DialogDescription>
              {t("studio_panel_generateModal_description")}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive px-1">{error}</p>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {t("studio_panel_generateModal_cancel")}
            </Button>
            <Button onClick={handleContinue} disabled={isLoading}>
              {isLoading
                ? t("studio_panel_generateFromReel_loading")
                : t("studio_panel_generateModal_continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
