import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { cn } from "@/shared/lib/utils";

export function SaveButton({
  saving,
  saved,
  onClick,
  disabled,
}: {
  saving: boolean;
  saved: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={saving || disabled}
      className={cn(
        "min-w-[80px] shrink-0 transition-all",
        saved && "bg-green-500/20 text-green-400 border-green-500/30"
      )}
      variant={saved ? "outline" : "default"}
    >
      {saving ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          {t("admin_config_saving")}
        </>
      ) : saved ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          {t("admin_config_saved")}
        </>
      ) : (
        t("admin_config_save")
      )}
    </Button>
  );
}
