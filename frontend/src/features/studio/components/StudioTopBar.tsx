import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const TABS = [
  { key: "discover", path: "/studio/discover" },
  { key: "generate", path: "/studio/generate" },
  { key: "queue", path: "/studio/queue" },
] as const;

interface Props {
  niche: string;
  onNicheChange: (niche: string) => void;
  onScan: () => void;
  activeTab: string;
}

export function StudioTopBar({ niche, onNicheChange, onScan, activeTab }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onScan();
  };

  return (
    <div className="ais-topbar">
      <Link to="/studio/discover" className="ais-logo">
        <div className="ais-logo-mark">✦</div>
        <div className="ais-logo-name">ReelStudio</div>
      </Link>

      <div className="ais-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`ais-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => navigate({ to: tab.path })}
          >
            {tab.key === "generate" && "✦ "}
            {t(`studio_tabs_${tab.key}`)}
          </button>
        ))}
      </div>

      <div className="ais-spacer" />

      <div className="ais-topbar-actions">
        <input
          ref={inputRef}
          className="ais-search-input"
          value={niche}
          onChange={(e) => onNicheChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("studio_search_placeholder")}
        />
        <button className="ais-scan-btn" onClick={onScan}>
          {t("studio_search_scan")}
        </button>
      </div>
    </div>
  );
}
