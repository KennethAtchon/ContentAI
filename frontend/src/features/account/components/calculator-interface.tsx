/**
 * Stub — the calculator has been replaced by ReelStudio.
 * This component exists only to prevent import errors in account-interactive.tsx.
 */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function CalculatorInterface() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40 }}>✦</div>
      <p style={{ fontSize: 16, fontWeight: 600 }}>
        {t("studio_tabs_discover")}
      </p>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        {t("studio_canvas_noReelSub")}
      </p>
      <Link
        to="/studio/discover"
        style={{
          background: "linear-gradient(135deg, #818CF8, #C084FC)",
          color: "white",
          padding: "8px 20px",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Open ReelStudio →
      </Link>
    </div>
  );
}
