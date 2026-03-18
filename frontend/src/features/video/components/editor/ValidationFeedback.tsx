import { useTranslation } from "react-i18next";
import type { CompositionIssue } from "../../types/composition.types";

export function ValidationFeedback({ issues }: { issues: CompositionIssue[] }) {
  const { t } = useTranslation();

  if (issues.length === 0) {
    return (
      <p className="text-[11px] text-success">{t("phase5_editor_validation_ok")}</p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-error">
        {t("phase5_editor_validation_issues")}
      </p>
      {issues.slice(0, 5).map((issue) => (
        <p key={`${issue.code}-${issue.itemIds.join(",")}`} className="text-[11px] text-error/90">
          {issue.message}
        </p>
      ))}
    </div>
  );
}
