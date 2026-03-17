import { useTranslation } from "react-i18next";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";

export type MediaBinPanelProps = {
  generatedContentId: number;
  onAppendVideoClip: (assetId: string, durationMs: number) => void;
};

export function MediaBinPanel({
  generatedContentId,
  onAppendVideoClip,
}: MediaBinPanelProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useContentAssets(generatedContentId);
  const assets = data?.assets ?? [];
  const videoAssets = assets.filter((asset) => asset.type === "video_clip");
  const audioAssets = assets.filter((asset) => asset.type === "voiceover" || asset.type === "music");

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_media_bin")}
      </p>
      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("studio_loading")}</p>
      ) : (
        <>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-medium text-foreground/80">
              {t("phase5_editor_media_video")}
            </p>
            {videoAssets.length > 0 ? (
              videoAssets.slice(0, 12).map((asset) => (
                <div
                  key={asset.id}
                  className="rounded border border-border/60 bg-muted/20 p-2"
                >
                  <p className="truncate text-[11px] text-foreground/85">
                    {asset.id}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("phase5_editor_media_duration", {
                      seconds: Math.max(1, Math.floor((asset.durationMs ?? 1000) / 1000)),
                    })}
                  </p>
                  <button
                    onClick={() => onAppendVideoClip(asset.id, asset.durationMs ?? 2000)}
                    className="mt-1 rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
                  >
                    {t("phase5_editor_media_add_to_timeline")}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("phase5_editor_media_empty_video")}
              </p>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-medium text-foreground/80">
              {t("phase5_editor_media_audio")}
            </p>
            {audioAssets.length > 0 ? (
              audioAssets.slice(0, 8).map((asset) => (
                <p key={asset.id} className="truncate text-[11px] text-muted-foreground">
                  {asset.id}
                </p>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("phase5_editor_media_empty_audio")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
