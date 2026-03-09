import { useTranslation } from "react-i18next";
import { fmtNum } from "../hooks/use-reels";
import type { ReelDetail } from "../types/reel.types";

interface Props {
  reel: ReelDetail;
}

export function PhonePreview({ reel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="ais-canvas-body">
      {/* Floating stat cards */}
      <div className="ais-float-card" style={{ top: 32, left: 40 }}>
        <div className="ais-float-card-label">{t("studio_panel_engagementRate")}</div>
        <div className="ais-float-card-val">{reel.engagementRate ?? "0"}%</div>
      </div>
      <div className="ais-float-card" style={{ top: 32, right: 40 }}>
        <div className="ais-float-card-label">{t("studio_panel_totalViews")}</div>
        <div className="ais-float-card-val">{fmtNum(reel.views)}</div>
      </div>
      <div className="ais-float-card" style={{ bottom: 80, left: 40 }}>
        <div className="ais-float-card-label">{t("studio_panel_posted")}</div>
        <div className="ais-float-card-val" style={{ fontSize: 14 }}>
          {reel.daysAgo != null ? `${reel.daysAgo}d ago` : "—"}
        </div>
      </div>
      <div className="ais-float-card" style={{ bottom: 80, right: 40 }}>
        <div className="ais-float-card-label">{t("studio_panel_likes")}</div>
        <div className="ais-float-card-val" style={{ color: "#C084FC" }}>
          {fmtNum(reel.likes)}
        </div>
      </div>

      {/* Phone mockup */}
      <div className="ais-phone">
        <div className="ais-phone-notch" />
        <div className="ais-phone-bg" />
        <div className="ais-phone-emoji">{reel.thumbnailEmoji ?? "🎬"}</div>
        <div className="ais-phone-actions">
          <div className="ais-phone-action">
            <div className="ais-phone-action-icon">❤️</div>
            <div className="ais-phone-action-label">{fmtNum(reel.likes)}</div>
          </div>
          <div className="ais-phone-action">
            <div className="ais-phone-action-icon">💬</div>
            <div className="ais-phone-action-label">{fmtNum(reel.comments)}</div>
          </div>
          <div className="ais-phone-action">
            <div className="ais-phone-action-icon">↗</div>
          </div>
        </div>
        <div className="ais-phone-content">
          <div className="ais-phone-overlay-user">{reel.username}</div>
          <div className="ais-phone-overlay-hook">
            {reel.hook ? `${reel.hook.slice(0, 60)}...` : ""}
          </div>
          {reel.audioName && (
            <div className="ais-phone-metrics">
              <div className="ais-phone-metric">
                <span>♪</span> {reel.audioName.slice(0, 20)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
