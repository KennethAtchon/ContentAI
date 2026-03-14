import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useApp } from "@/shared/contexts/app-context";

interface UsageData {
  contentGenerated: number;
  contentGeneratedLimit: number | null;
}

const WARNING_THRESHOLD = 0.8;

export function UsageWarningBanner() {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher<UsageData>();

  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-03"
  const dismissKey = `usage_warning_dismissed_${currentMonth}`;
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(dismissKey) === "true",
  );

  const { data } = useQuery({
    queryKey: queryKeys.api.reelsUsage(),
    queryFn: () => fetcher("/api/reels/usage"),
    enabled: !!user,
  });

  if (dismissed || !data) return null;

  const { contentGenerated, contentGeneratedLimit } = data;
  if (!contentGeneratedLimit || contentGeneratedLimit < 0) return null;

  const pct = contentGenerated / contentGeneratedLimit;
  if (pct < WARNING_THRESHOLD || pct >= 1) return null;

  const pctDisplay = Math.round(pct * 100);

  function handleDismiss() {
    sessionStorage.setItem(dismissKey, "true");
    setDismissed(true);
  }

  return (
    <div className="mx-4 mb-2 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
      <span className="text-amber-400 text-xs font-medium">
        {t("studio_chat_usageWarning_body", { pct: pctDisplay })}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="/pricing"
          className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
        >
          {t("studio_chat_usageWarning_upgrade")}
        </a>
        <button
          onClick={handleDismiss}
          className="text-amber-400/60 hover:text-amber-400 transition-colors"
          aria-label={t("studio_chat_usageWarning_dismiss")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
