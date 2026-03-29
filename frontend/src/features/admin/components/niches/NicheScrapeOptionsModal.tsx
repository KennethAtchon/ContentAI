import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  type AdminNiche,
  type ScrapeConfigOverride,
} from "@/features/admin/hooks/use-niches";

// ── Scrape Options Modal ──────────────────────────────────────────────────────

export function NicheScrapeOptionsModal({
  niche,
  open,
  onClose,
  onRun,
  isPending,
}: {
  niche: AdminNiche;
  open: boolean;
  onClose: () => void;
  onRun: (config: ScrapeConfigOverride) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState("");
  const [minViews, setMinViews] = useState("");
  const [maxDaysOld, setMaxDaysOld] = useState("");
  const [viralOnly, setViralOnly] = useState<boolean | null>(null);

  // Reset to empty (not defaults) each time modal opens
  useEffect(() => {
    if (open) {
      setLimit("");
      setMinViews("");
      setMaxDaysOld("");
      setViralOnly(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: ScrapeConfigOverride = {};
    if (limit !== "") config.limit = parseInt(limit, 10);
    if (minViews !== "") config.minViews = parseInt(minViews, 10);
    if (maxDaysOld !== "") config.maxDaysOld = parseInt(maxDaysOld, 10);
    if (viralOnly !== null) config.viralOnly = viralOnly;
    onRun(config);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin_niche_scrape_options_title")}</DialogTitle>
          <p className="text-sm text-dim-2 mt-1">
            {t("admin_niche_scrape_options_description")}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dim-1">
                {t("admin_niche_scrape_limit_label")}
                {niche.scrapeLimit != null && (
                  <span className="ml-1.5 text-sm text-dim-3">
                    {t("admin_niche_scrape_defaults_badge", {
                      value: niche.scrapeLimit,
                    })}
                  </span>
                )}
              </label>
              <Input
                type="number"
                min={1}
                max={10000}
                placeholder={String(niche.scrapeLimit ?? 100)}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="h-8 text-base"
              />
              <p className="text-sm text-dim-3">
                {t("admin_niche_scrape_limit_hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dim-1">
                {t("admin_niche_scrape_min_views_label")}
                {niche.scrapeMinViews != null && (
                  <span className="ml-1.5 text-sm text-dim-3">
                    {t("admin_niche_scrape_defaults_badge", {
                      value: niche.scrapeMinViews.toLocaleString(),
                    })}
                  </span>
                )}
              </label>
              <Input
                type="number"
                min={0}
                placeholder={String(niche.scrapeMinViews ?? 0)}
                value={minViews}
                onChange={(e) => setMinViews(e.target.value)}
                className="h-8 text-base"
              />
              <p className="text-sm text-dim-3">
                {t("admin_niche_scrape_min_views_hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dim-1">
                {t("admin_niche_scrape_max_days_label")}
                {niche.scrapeMaxDaysOld != null && (
                  <span className="ml-1.5 text-sm text-dim-3">
                    {t("admin_niche_scrape_defaults_badge", {
                      value: niche.scrapeMaxDaysOld,
                    })}
                  </span>
                )}
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                placeholder={String(niche.scrapeMaxDaysOld ?? 30)}
                value={maxDaysOld}
                onChange={(e) => setMaxDaysOld(e.target.value)}
                className="h-8 text-base"
              />
              <p className="text-sm text-dim-3">
                {t("admin_niche_scrape_max_days_hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dim-1">
                {t("admin_niche_scrape_viral_only_label")}
                {niche.scrapeIncludeViralOnly != null && (
                  <span className="ml-1.5 text-sm text-dim-3">
                    {t("admin_niche_scrape_defaults_badge", {
                      value: niche.scrapeIncludeViralOnly ? "on" : "off",
                    })}
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2 h-8">
                <Switch
                  checked={viralOnly ?? niche.scrapeIncludeViralOnly ?? false}
                  onCheckedChange={(v) => setViralOnly(v)}
                />
                <span className="text-sm text-dim-2">
                  {t("admin_niche_scrape_viral_only_hint")}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? `${t("admin_niche_queuing")}`
                : t("admin_niche_run_scrape")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
