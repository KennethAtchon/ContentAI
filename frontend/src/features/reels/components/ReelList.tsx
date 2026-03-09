import { useTranslation } from "react-i18next";
import { fmtNum } from "../hooks/use-reels";
import type { Reel } from "../types/reel.types";

interface Props {
  reels: Reel[];
  activeId: number | null;
  onSelect: (id: number) => void;
}

export function ReelList({ reels, activeId, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="ais-sidebar-header">
        {t("studio_sidebar_sourceReels")}
        <span className="ais-sidebar-count">{reels.length}</span>
      </div>
      <div className="ais-asset-list">
        {reels.map((reel) => (
          <button
            key={reel.id}
            className={`ais-asset ${activeId === reel.id ? "active" : ""}`}
            onClick={() => onSelect(reel.id)}
          >
            <div className="ais-asset-thumb">
              {reel.thumbnailEmoji ?? "🎬"}
            </div>
            <div className="ais-asset-info">
              <div className="ais-asset-user">{reel.username}</div>
              <div className="ais-asset-stat">
                {fmtNum(reel.views)} · {reel.engagementRate ?? "0"}%
              </div>
            </div>
          </button>
        ))}
        {reels.length === 0 && (
          <div className="ais-empty" style={{ padding: "24px 14px" }}>
            <div className="ais-empty-title" style={{ fontSize: 11 }}>
              {t("studio_sidebar_noReels")}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
