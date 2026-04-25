import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { Section } from "../components/Section";
import { TabSkeleton } from "../components/TabSkeleton";
import { ConfigSwitchField } from "../components/ConfigSwitchField";

export function FeatureFlagsTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("feature_flags");
  const getBool = (key: string) => entries[key]?.value === "true";

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section
        title="Feature Flags"
        description="Changes take effect immediately without redeployment."
      >
        <div className="space-y-2.5">
          <ConfigSwitchField
            label="Cron Jobs"
            description="Enable background scheduled jobs (scraping, analytics, cleanup)"
            value={getBool("cron_jobs_enabled")}
            onSave={(v) => updateEntry("cron_jobs_enabled", v)}
          />
          <ConfigSwitchField
            label="Prometheus Metrics"
            description="Expose /metrics endpoint for Prometheus scraping"
            value={getBool("metrics_enabled")}
            onSave={(v) => updateEntry("metrics_enabled", v)}
          />
          <ConfigSwitchField
            label="Debug Logging"
            description="Verbose server logs — avoid enabling in production long-term"
            value={getBool("debug_enabled")}
            onSave={(v) => updateEntry("debug_enabled", v)}
          />
          <ConfigSwitchField
            label="Mock Reel Scrape (Dev)"
            description="Return fake reel data instead of calling Instagram API"
            value={getBool("mock_reel_scrape")}
            onSave={(v) => updateEntry("mock_reel_scrape", v)}
          />
          <ConfigSwitchField
            label="DB Health Checks"
            description="Run periodic database health checks and connection validation"
            value={getBool("db_health_checks_enabled")}
            onSave={(v) => updateEntry("db_health_checks_enabled", v)}
          />
        </div>
      </Section>
    </div>
  );
}
