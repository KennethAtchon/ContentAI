import { useTranslation } from "react-i18next";

export function CaptionLanguageScopeNotice() {
  const { t } = useTranslation();

  return (
    <p className="text-[10px] text-dim-3 -mt-1 mb-2">
      {t("editor_caption_english_only")}
    </p>
  );
}
