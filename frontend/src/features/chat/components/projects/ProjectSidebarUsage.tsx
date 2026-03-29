interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
}

interface UsageStats {
  contentGenerated: number;
  contentGeneratedLimit: number;
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number;
}

interface ProjectSidebarUsageProps {
  usageData: UsageStats;
  usageLimitReached: boolean;
  hasEnterpriseAccess: boolean;
  t: (key: string) => string;
}

function UsageBar({ label, used, limit }: UsageBarProps) {
  const pct = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate">{label}</span>
        <span
          className={
            isAtLimit
              ? "text-error font-semibold"
              : isNearLimit
                ? "text-warning"
                : "text-muted-foreground"
          }
        >
          {used}/{limit === -1 ? "∞" : limit}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAtLimit ? "bg-error" : isNearLimit ? "bg-warning" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ProjectSidebarUsage({
  usageData,
  usageLimitReached,
  hasEnterpriseAccess,
  t,
}: ProjectSidebarUsageProps) {
  return (
    <div className="p-3 border-t space-y-2">
      <UsageBar
        label={t("studio_generate_usage_generations")}
        used={usageData.contentGenerated}
        limit={usageData.contentGeneratedLimit}
      />
      <UsageBar
        label={t("studio_generate_usage_analyses")}
        used={usageData.reelsAnalyzed}
        limit={usageData.reelsAnalyzedLimit}
      />
      {usageLimitReached && !hasEnterpriseAccess && (
        <a
          href="/pricing"
          className="block w-full text-center text-sm font-semibold py-1.5 rounded-md bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
        >
          {t("studio_generate_upgrade")}
        </a>
      )}
    </div>
  );
}

