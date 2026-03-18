import { useTranslation } from "react-i18next";
import { useContentAssets } from "../hooks/use-content-assets";

interface AudioStatusBadgeProps {
  generatedContentId: number;
  onClick?: () => void;
}

export function AudioStatusBadge({
  generatedContentId,
  onClick,
}: AudioStatusBadgeProps) {
  const { t } = useTranslation();
  const { data } = useContentAssets(generatedContentId);

  const assets = data?.assets ?? [];
  const hasVoiceover = assets.some((a) => a.type === "voiceover");
  const hasMusic = assets.some((a) => a.type === "music");

  if (!hasVoiceover) return null;

  const label = hasMusic
    ? t("audio_status_voiceoverAndMusic")
    : t("audio_status_voiceover");

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] text-success dark:text-success hover:underline"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
      {label}
    </button>
  );
}
