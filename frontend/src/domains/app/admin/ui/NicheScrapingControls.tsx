import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/ui/primitives/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Input } from "@/shared/ui/primitives/input";
import { Label } from "@/shared/ui/primitives/label";
import { Switch } from "@/shared/ui/primitives/switch";
import { Loader2, Settings, Play } from "lucide-react";
import { authenticatedFetch } from "@/shared/api/authenticated-fetch";
import { debugLog } from "@/shared/debug/debug";

interface ScrapeConfig {
  limit: number;
  minViews: number;
  maxDaysOld: number;
  viralOnly: boolean;
}


interface ScrapeJob {
  jobId: string;
  nicheId: number;
  nicheName: string;
  status: string;
  config: ScrapeConfig;
}

export function NicheScrapingControls({ nicheId }: { nicheId: number }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastJob, setLastJob] = useState<ScrapeJob | null>(null);
  const [config, setConfig] = useState<ScrapeConfig>({
    limit: 100,
    minViews: 1000,
    maxDaysOld: 30,
    viralOnly: false,
  });

  // Load niche configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await authenticatedFetch(
          `/api/admin/niches/${nicheId}/config`
        );
        if (response.ok) {
          const data = await response.json();
          setConfig(data.config);
        }
      } catch (error) {
        debugLog.error("Failed to load niche config", {
          service: "niche-scraping-controls",
          operation: "loadConfig",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [nicheId]);

  // Save configuration
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const response = await authenticatedFetch(
        `/api/admin/niches/${nicheId}/config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }
      );

      if (response.ok) {
        toast.success(t("admin_niche_scrape_config_saved"));
      } else {
        toast.error(t("admin_niche_scrape_config_save_error"));
      }
    } catch (error) {
      debugLog.error("Failed to save niche config", {
        service: "niche-scraping-controls",
        operation: "handleSaveConfig",
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error(t("admin_niche_scrape_config_save_error"));
    } finally {
      setSaving(false);
    }
  };

  // Start scraping job
  const handleStartScraping = async () => {
    setScanning(true);
    try {
      const response = await authenticatedFetch(
        `/api/admin/niches/${nicheId}/scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config), // Use current config as override
        }
      );

      if (response.ok) {
        const job = await response.json();
        setLastJob(job);
        toast.success(t("admin_niche_scrape_job_started"));
      } else {
        toast.error(t("admin_niche_scrape_job_start_error"));
      }
    } catch (error) {
      debugLog.error("Failed to start scraping job", {
        service: "niche-scraping-controls",
        operation: "handleStartScraping",
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error(t("admin_niche_scrape_job_start_error"));
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("admin_niche_scraping_configuration")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="limit">
                {t("admin_niche_scrape_limit_label")}
              </Label>
              <Input
                id="limit"
                type="number"
                min="1"
                max="10000"
                value={config.limit}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    limit: parseInt(e.target.value) || 100,
                  })
                }
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin_niche_scrape_limit_hint")}
              </p>
            </div>

            <div>
              <Label htmlFor="minViews">
                {t("admin_niche_scrape_min_views_label")}
              </Label>
              <Input
                id="minViews"
                type="number"
                min="0"
                value={config.minViews}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    minViews: parseInt(e.target.value) || 0,
                  })
                }
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin_niche_scrape_min_views_hint")}
              </p>
            </div>

            <div>
              <Label htmlFor="maxDaysOld">
                {t("admin_niche_scrape_max_days_label")}
              </Label>
              <Input
                id="maxDaysOld"
                type="number"
                min="1"
                max="365"
                value={config.maxDaysOld}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxDaysOld: parseInt(e.target.value) || 30,
                  })
                }
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t("admin_niche_scrape_max_days_hint")}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="viralOnly"
                checked={config.viralOnly}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, viralOnly: checked })
                }
              />
              <Label htmlFor="viralOnly">
                {t("admin_niche_scrape_viral_only_label")}
              </Label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin_niche_scrape_save_config")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scraping Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            {t("admin_niche_scrape_start_scraping")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">
              {t("admin_niche_scrape_current_config")}:
            </h4>
            <ul className="text-base space-y-1">
              <li>
                • {t("admin_niche_scrape_limit_label")}: {config.limit}
              </li>
              <li>
                • {t("admin_niche_scrape_min_views_label")}:{" "}
                {config.minViews.toLocaleString()}
              </li>
              <li>
                • {t("admin_niche_scrape_max_days_label")}: {config.maxDaysOld}
              </li>
              <li>
                • {t("admin_niche_scrape_viral_only_label")}:{" "}
                {config.viralOnly ? t("common_yes") : t("common_no")}
              </li>
            </ul>
          </div>

          <Button onClick={handleStartScraping} disabled={scanning}>
            {scanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin_niche_scrape_start_job")}
          </Button>

          {lastJob && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">
                {t("admin_niche_scrape_last_job")}:
              </h4>
              <p className="text-base">Job ID: {lastJob.jobId}</p>
              <p className="text-base">Status: {lastJob.status}</p>
              <p className="text-base">Niche: {lastJob.nicheName}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
