import { useTranslation } from "react-i18next";

export function AnimateTab() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
      <span className="text-2xl opacity-20">✦</span>
      <p className="text-xs text-dim-3">{t("editor_inspector_coming_soon")}</p>
    </div>
  );
}
